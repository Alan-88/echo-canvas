//! WebSocket integration tests.
//! These tests require a running backend instance on ws://127.0.0.1:3000.

use futures::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};
use uuid::Uuid;
use whiteboard_shared::{Action, ClientMessage, ServerMessage, ShapeData};

type WsStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

fn line_shape(points: Vec<f64>, stroke: &str, stroke_width: f64) -> ShapeData {
    ShapeData::Line {
        points,
        stroke: stroke.to_string(),
        stroke_width,
        x: None,
        y: None,
        rotation: None,
        scale_x: None,
        scale_y: None,
    }
}

fn extract_canvas_and_layer_ids(sync_state: &ServerMessage) -> (Uuid, Uuid) {
    let ServerMessage::SyncState {
        canvas_ids,
        canvases,
        ..
    } = sync_state
    else {
        panic!("expected SyncState message")
    };

    let canvas_id = canvas_ids
        .first()
        .copied()
        .or_else(|| canvases.keys().next().copied())
        .expect("sync state should contain at least one canvas");

    let canvas = canvases
        .get(&canvas_id)
        .expect("canvas id from SyncState should exist in canvases map");

    let layer_id = canvas
        .layer_ids
        .first()
        .copied()
        .or_else(|| canvas.layers.keys().next().copied())
        .expect("canvas should contain at least one layer");

    (canvas_id, layer_id)
}

async fn connect_client(name: &str, room_id: &str) -> WsStream {
    let url = format!("ws://127.0.0.1:3000/ws/{room_id}");
    let (ws_stream, _) = connect_async(url)
        .await
        .unwrap_or_else(|_| panic!("{name} failed to connect"));

    println!("✅ {} connected", name);
    ws_stream
}

async fn send_message(ws: &mut WsStream, msg: ClientMessage) {
    let json = serde_json::to_string(&msg).unwrap();
    ws.send(Message::Text(json)).await.unwrap();
}

async fn recv_message(ws: &mut WsStream) -> Option<ServerMessage> {
    match tokio::time::timeout(tokio::time::Duration::from_secs(2), ws.next()).await {
        Ok(Some(Ok(Message::Text(text)))) => serde_json::from_str(&text).ok(),
        _ => None,
    }
}

#[tokio::test]
#[ignore = "requires running backend server on ws://127.0.0.1:3000"]
async fn test_drawing_sync_and_history_rewrite() {
    let room_id = format!("it-history-{}", Uuid::new_v4());
    println!("\n🧪 开始测试：绘图同步 & 历史重写\n");

    let mut client_a = connect_client("Client A", &room_id).await;
    let mut client_b = connect_client("Client B", &room_id).await;

    let sync_a = recv_message(&mut client_a)
        .await
        .expect("client A should receive SyncState");
    let sync_b = recv_message(&mut client_b)
        .await
        .expect("client B should receive SyncState");

    println!("📦 Client A received SyncState: {:?}", sync_a);
    println!("📦 Client B received SyncState: {:?}", sync_b);

    assert!(matches!(sync_a, ServerMessage::SyncState { .. }));
    assert!(matches!(sync_b, ServerMessage::SyncState { .. }));

    let (canvas_id, layer_id) = extract_canvas_and_layer_ids(&sync_a);
    let (canvas_id_b, layer_id_b) = extract_canvas_and_layer_ids(&sync_b);
    assert_eq!(canvas_id, canvas_id_b);
    assert_eq!(layer_id, layer_id_b);

    let draw1_id = Uuid::new_v4();

    println!("\n🎨 Client A draws Line 1");
    send_message(
        &mut client_a,
        ClientMessage::LayerOp {
            canvas_id,
            layer_id,
            action: Action::Draw {
                id: draw1_id,
                shape: line_shape(vec![0.0, 0.0, 100.0, 100.0], "#FF0000", 2.0),
            },
        },
    )
    .await;

    let msg_a = recv_message(&mut client_a).await;
    println!("📡 Client A received: {:?}", msg_a);

    let msg_b = recv_message(&mut client_b).await;
    println!("📡 Client B received: {:?}", msg_b);

    assert!(matches!(
        msg_b,
        Some(ServerMessage::BroadCast {
            action: Action::Draw { .. },
            ..
        })
    ));

    let draw2_id = Uuid::new_v4();

    println!("\n🎨 Client A draws Line 2");
    send_message(
        &mut client_a,
        ClientMessage::LayerOp {
            canvas_id,
            layer_id,
            action: Action::Draw {
                id: draw2_id,
                shape: line_shape(vec![100.0, 0.0, 200.0, 100.0], "#00FF00", 2.0),
            },
        },
    )
    .await;

    recv_message(&mut client_a).await;
    let msg_b2 = recv_message(&mut client_b).await;
    println!("📡 Client B received Line 2: {:?}", msg_b2);

    println!("\n⏪ Client A executes Undo");
    send_message(
        &mut client_a,
        ClientMessage::LayerOp {
            canvas_id,
            layer_id,
            action: Action::Undo,
        },
    )
    .await;

    recv_message(&mut client_a).await;
    let undo_b = recv_message(&mut client_b).await;
    println!("📡 Client B received Undo: {:?}", undo_b);

    assert!(matches!(
        undo_b,
        Some(ServerMessage::BroadCast {
            action: Action::Undo,
            ..
        })
    ));

    let draw3_id = Uuid::new_v4();

    println!("\n🎨 Client A draws Line 3 (triggers history rewrite!)");
    send_message(
        &mut client_a,
        ClientMessage::LayerOp {
            canvas_id,
            layer_id,
            action: Action::Draw {
                id: draw3_id,
                shape: line_shape(vec![0.0, 100.0, 100.0, 200.0], "#0000FF", 3.0),
            },
        },
    )
    .await;

    recv_message(&mut client_a).await;
    let draw3_b = recv_message(&mut client_b).await;
    println!("📡 Client B received Line 3: {:?}", draw3_b);

    println!("\n🔍 Client C joins to verify final state");
    let mut client_c = connect_client("Client C", &room_id).await;

    let final_state = recv_message(&mut client_c)
        .await
        .expect("client C should receive SyncState");
    println!("📦 Client C received SyncState: {:?}", final_state);

    if let ServerMessage::SyncState { canvases, .. } = final_state {
        let canvas = canvases
            .get(&canvas_id)
            .expect("target canvas should exist in SyncState");
        let layer_view = canvas
            .layers
            .get(&layer_id)
            .expect("target layer should exist in SyncState");

        println!("\n📊 Final Layer State:");
        println!("   Pointer: {}", layer_view.pointer);
        println!("   History length: {}", layer_view.history.len());
        println!("   History: {:?}", layer_view.history);

        assert_eq!(layer_view.history.len(), 2, "history should have 2 actions");
        assert_eq!(layer_view.pointer, 2, "pointer should be at position 2");

        match layer_view.history[0].clone() {
            Action::Draw { id, .. } => {
                assert_eq!(id, draw1_id, "first action should be Draw1");
            }
            _ => panic!("expected Draw action"),
        }

        match layer_view.history[1].clone() {
            Action::Draw { id, .. } => {
                assert_eq!(id, draw3_id, "second action should be Draw3");
            }
            _ => panic!("expected Draw action"),
        }
    } else {
        panic!("expected SyncState message");
    }

    println!("\n🎉 所有测试通过！\n");
}

#[tokio::test]
#[ignore = "requires running backend server on ws://127.0.0.1:3000"]
async fn test_clear_and_undo_clear() {
    let room_id = format!("it-clear-{}", Uuid::new_v4());
    println!("\n🧪 开始测试：Clear & Undo Clear\n");

    let mut client_a = connect_client("Client A", &room_id).await;
    let mut client_b = connect_client("Client B", &room_id).await;

    let sync_a = recv_message(&mut client_a)
        .await
        .expect("client A should receive SyncState");
    let sync_b = recv_message(&mut client_b)
        .await
        .expect("client B should receive SyncState");

    let (canvas_id, layer_id) = extract_canvas_and_layer_ids(&sync_a);
    let (canvas_id_b, layer_id_b) = extract_canvas_and_layer_ids(&sync_b);
    assert_eq!(canvas_id, canvas_id_b);
    assert_eq!(layer_id, layer_id_b);

    println!("🎨 Client A draws 2 lines");
    for i in 0..2 {
        send_message(
            &mut client_a,
            ClientMessage::LayerOp {
                canvas_id,
                layer_id,
                action: Action::Draw {
                    id: Uuid::new_v4(),
                    shape: line_shape(
                        vec![i as f64 * 50.0, 0.0, i as f64 * 50.0 + 50.0, 50.0],
                        "#000000",
                        1.0,
                    ),
                },
            },
        )
        .await;
        let _ = recv_message(&mut client_a).await;
        let _ = recv_message(&mut client_b).await;
    }

    println!("🗑️  Client A executes Clear");
    send_message(
        &mut client_a,
        ClientMessage::LayerOp {
            canvas_id,
            layer_id,
            action: Action::Clear,
        },
    )
    .await;
    recv_message(&mut client_a).await;
    let clear_b = recv_message(&mut client_b).await;
    assert!(matches!(
        clear_b,
        Some(ServerMessage::BroadCast {
            action: Action::Clear,
            ..
        })
    ));

    let mut client_c = connect_client("Client C", &room_id).await;
    let final_state = recv_message(&mut client_c)
        .await
        .expect("client C should receive SyncState");

    if let ServerMessage::SyncState { canvases, .. } = final_state {
        let canvas = canvases
            .get(&canvas_id)
            .expect("target canvas should exist in SyncState");
        let layer = canvas
            .layers
            .get(&layer_id)
            .expect("target layer should exist in SyncState");
        assert_eq!(layer.history.len(), 3);
        assert_eq!(layer.pointer, 3);
        println!("✅ Clear 状态正确");
    } else {
        panic!("expected SyncState message");
    }

    println!("\n🎉 Clear 测试通过！\n");
}
