use std::sync::Arc;

use crate::state::{AppState, RoomState};
use whiteboard_shared::ServerMessage;

pub fn handle_save_room_request(
    room_arc: Arc<std::sync::RwLock<RoomState>>,
    app_state: Arc<AppState>,
    force_new_version: bool,
) {
    if force_new_version {
        let mut room = room_arc.write().unwrap();
        room.associated_restore_token = None;
    }

    let room = room_arc.read().unwrap();
    let save_result = if app_state.single_player_room_id.as_deref() == Some(&room.room_id) {
        app_state.persistence.save_single_player_room(&room)
    } else {
        app_state.persistence.save_room(&room)
    };

    match save_result {
        Ok(response) => {
            drop(room);
            let mut room = room_arc.write().unwrap();
            room.associated_restore_token = if response.restore_token.is_empty() {
                None
            } else {
                Some(response.restore_token.clone())
            };

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
        Err(error) => {
            if let Some(tx) = &room.tx {
                let _ = tx.send(ServerMessage::Error {
                    message: format!("保存失败: {}", error),
                });
            }
        }
    }
}

pub fn handle_close_room_request(
    room_arc: Arc<std::sync::RwLock<RoomState>>,
    app_state: Arc<AppState>,
    save_before_close: bool,
) {
    let room_id = {
        let room = room_arc.read().unwrap();
        room.room_id.clone()
    };

    if save_before_close {
        let room = room_arc.read().unwrap();
        let save_result = if app_state.single_player_room_id.as_deref() == Some(&room.room_id) {
            app_state.persistence.save_single_player_room(&room)
        } else {
            app_state.persistence.save_room(&room)
        };

        if let Ok(response) = save_result {
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

    {
        let room = room_arc.read().unwrap();
        if let Some(tx) = &room.tx {
            let _ = tx.send(ServerMessage::RoomClosed {
                room_id: room_id.clone(),
                closed_by: "user".to_string(),
                message: format!("房间 {} 已关闭", room_id),
            });
        }
    }

    app_state.remove_room(&room_id);
}
