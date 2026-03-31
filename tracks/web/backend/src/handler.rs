use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;

use crate::state::AppState;
use crate::ws_message_codec::{decode_client_message, encode_server_message, WsMessageCodec};
use crate::ws_room_commands::{handle_canvas_command, handle_layer_command};
use crate::ws_sync_state::build_sync_state_message;
use whiteboard_shared::{ClientMessage, ServerMessage};

// 1. HTTP 入口：升级协议（带 room_id 参数）
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(room_id): Path<String>, // 从 URL /ws/:room_id 提取
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state, room_id))
}

// 2. 连接处理核心逻辑
async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>, room_id: String) {
    println!("🔌 New WebSocket connection to room: {}", room_id);
    let ws_codec = WsMessageCodec::from_env();
    println!("[WS] Outbound codec: {}", ws_codec.as_str());

    // TODO: 这里应该解密 room_id，暂时直接使用
    // let decrypted_room_id = decrypt_room_id(&room_id);
    let actual_room_id = room_id.clone(); // 暂时直接使用

    // 获取或创建房间
    let room_arc = state.get_or_create_room(&actual_room_id);

    // --- 阶段 1: 初始化 (Sync State) ---
    // 构建全量同步消息
    let sync_msg = {
        let room = room_arc.read().unwrap();
        build_sync_state_message(&room)
    };

    let encoded_sync_message = match encode_server_message(&sync_msg, ws_codec) {
        Ok(frame) => frame,
        Err(e) => {
            println!("❌ Failed to encode SyncState: {}", e);
            return;
        }
    };

    if socket.send(encoded_sync_message).await.is_err() {
        println!("❌ Failed to send SyncState, connection closed");
        return;
    }

    // --- 阶段 2: 订阅广播通道 ---
    let rx = {
        let mut room = room_arc.write().unwrap();
        room.ensure_channel();
        room.tx.as_ref().unwrap().subscribe()
    };

    // --- 阶段 3: 拆分流进入实时模式 ---
    let (mut sender, mut receiver) = socket.split();
    let mut rx = rx;

    // 任务 A: 转发广播消息 -> WebSocket
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            match encode_server_message(&msg, ws_codec) {
                Ok(frame) => {
                    if sender.send(frame).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    println!("❌ Failed to encode broadcast message: {}", e);
                    break;
                }
            }
        }
    });

    // 任务 B: 接收 WebSocket 消息 -> 更新 State -> 触发广播
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                println!("📥 Received text frame ({} bytes)", text.len());
                match decode_client_message(Message::Text(text)) {
                    Ok(Some(client_msg)) => {
                        println!("✅ Parsed message: {:?}", client_msg);
                        handle_client_message(client_msg, room_arc.clone(), state.clone());
                    }
                    Ok(None) => {}
                    Err(e) => println!("❌ Failed to parse text message: {}", e),
                }
            }
            Message::Binary(bytes) => {
                println!("📥 Received binary frame ({} bytes)", bytes.len());
                match decode_client_message(Message::Binary(bytes)) {
                    Ok(Some(client_msg)) => {
                        println!("✅ Parsed message: {:?}", client_msg);
                        handle_client_message(client_msg, room_arc.clone(), state.clone());
                    }
                    Ok(None) => {}
                    Err(e) => println!("❌ Failed to parse binary message: {}", e),
                }
            }
            Message::Ping(_) | Message::Pong(_) | Message::Close(_) => {
                // Ignore control frames, axum handles protocol-level details.
            }
        }
    }

    send_task.abort();
    println!(
        "🔌 WebSocket connection closed for room: {}",
        actual_room_id
    );
}

// 处理客户端消息
fn handle_client_message(
    msg: ClientMessage,
    room_arc: Arc<std::sync::RwLock<crate::state::RoomState>>,
    app_state: Arc<AppState>,
) {
    // 更新房间活动时间
    {
        let mut room = room_arc.write().unwrap();
        room.touch();
    }

    match msg {
        ClientMessage::Join => {
            println!("👋 Join message received (SyncState already sent)");
        }

        ClientMessage::SaveRoom { force_new_version } => {
            println!(
                "💾 Save room request received (force_new_version: {})",
                force_new_version
            );

            // 如果强制创建新版本，临时清除关联token
            if force_new_version {
                let mut room = room_arc.write().unwrap();
                room.associated_restore_token = None;
            }

            let room = room_arc.read().unwrap();
            match app_state.persistence.save_room(&room) {
                Ok(response) => {
                    println!(
                        "✅ Room '{}' saved successfully (token: {})",
                        room.room_id, response.restore_token
                    );

                    // 更新房间的关联token
                    drop(room); // 释放读锁
                    let mut room = room_arc.write().unwrap();
                    room.associated_restore_token = Some(response.restore_token.clone());

                    // 发送保存成功消息
                    if let Some(tx) = &room.tx {
                        let _ = tx.send(ServerMessage::RoomSaved {
                            restore_token: response.restore_token,
                            saved_at: response.saved_at,
                            save_count: response.save_count,
                            is_update: response.is_update,
                            message: response.message,
                        });
                    }
                }
                Err(e) => {
                    println!("❌ Failed to save room: {}", e);
                    if let Some(tx) = &room.tx {
                        let _ = tx.send(ServerMessage::Error {
                            message: format!("保存失败: {}", e),
                        });
                    }
                }
            }
        }

        ClientMessage::CloseRoom { save_before_close } => {
            println!(
                "🚪 Close room request received (save_before_close: {})",
                save_before_close
            );

            let room_id = {
                let room = room_arc.read().unwrap();
                room.room_id.clone()
            };

            // 可选保存
            if save_before_close {
                let room = room_arc.read().unwrap();
                if let Ok(response) = app_state.persistence.save_room(&room) {
                    println!(
                        "✅ Room '{}' saved before closing (token: {})",
                        room_id, response.restore_token
                    );

                    // 发送保存成功消息
                    if let Some(tx) = &room.tx {
                        let _ = tx.send(ServerMessage::RoomSaved {
                            restore_token: response.restore_token,
                            saved_at: response.saved_at,
                            save_count: response.save_count,
                            is_update: response.is_update,
                            message: response.message,
                        });
                    }
                }
            }

            // 广播关闭消息
            {
                let room = room_arc.read().unwrap();
                if let Some(tx) = &room.tx {
                    let _ = tx.send(ServerMessage::RoomClosed {
                        room_id: room_id.clone(),
                        closed_by: "user".to_string(), // TODO: 实现用户标识
                        message: format!("房间 {} 已关闭", room_id),
                    });
                }
            }

            // 从内存中卸载房间
            app_state.remove_room(&room_id);
        }

        ClientMessage::RestoreRoom { .. } => {
            println!("⚠️ RestoreRoom should be handled via HTTP API, not WebSocket");
            let room = room_arc.read().unwrap();
            if let Some(tx) = &room.tx {
                let _ = tx.send(ServerMessage::Error {
                    message: "恢复房间请使用 HTTP API".to_string(),
                });
            }
        }

        ClientMessage::CanvasCtrl(cmd) => {
            println!("🎨 Processing CanvasCtrl: {:?}", cmd);
            handle_canvas_command(cmd, room_arc);
        }

        ClientMessage::LayerOp {
            canvas_id,
            layer_id,
            action,
        } => {
            println!(
                "🎨 Processing LayerOp - Canvas: {}, Layer: {}",
                canvas_id, layer_id
            );

            // 获取 Canvas（只获取，不创建）
            let canvas_arc = {
                let room = room_arc.read().unwrap();
                match room.canvases.get(&canvas_id) {
                    Some(canvas) => canvas.clone(),
                    None => {
                        println!("⚠️ Canvas {} not found, ignoring action", canvas_id);
                        return;
                    }
                }
            };

            // 获取 Layer（只获取，不创建）
            let layer_arc = {
                let canvas = canvas_arc.read().unwrap();
                match canvas.layers.get(&layer_id) {
                    Some(layer) => layer.clone(),
                    None => {
                        println!(
                            "⚠️ Layer {} not found in canvas {}, ignoring action",
                            layer_id, canvas_id
                        );
                        return;
                    }
                }
            };

            // 应用动作
            {
                let mut layer = layer_arc.write().unwrap();
                layer.apply_action(action.clone());
                println!(
                    "   Layer pointer now: {}, history length: {}",
                    layer.pointer,
                    layer.actions.len()
                );
            }

            // 广播
            let room = room_arc.read().unwrap();
            if let Some(tx) = &room.tx {
                let _ = tx.send(ServerMessage::BroadCast {
                    canvas_id,
                    layer_id,
                    action,
                });
            }
        }

        ClientMessage::LayerCtrl(cmd) => {
            println!("🎛️ Processing LayerCtrl: {:?}", cmd);
            handle_layer_command(cmd, room_arc);
        }
    }
}
