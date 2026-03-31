use std::sync::Arc;

use whiteboard_shared::{CanvasCommand, LayerCommand, ServerMessage};

pub fn handle_canvas_command(
    cmd: CanvasCommand,
    room_arc: Arc<std::sync::RwLock<crate::state::RoomState>>,
) {
    match cmd {
        CanvasCommand::Create { id, ref name } => {
            {
                let mut room = room_arc.write().unwrap();
                let _ = room.get_or_create_canvas(id, name.clone());
            }

            let room = room_arc.read().unwrap();
            if let Some(tx) = &room.tx {
                let _ = tx.send(ServerMessage::CanvasUpdate {
                    command: cmd.clone(),
                });
            }
        }
        CanvasCommand::Delete { id } => {
            {
                let mut room = room_arc.write().unwrap();
                let _ = room.delete_canvas(id);
            }

            let room = room_arc.read().unwrap();
            if let Some(tx) = &room.tx {
                let _ = tx.send(ServerMessage::CanvasUpdate {
                    command: cmd.clone(),
                });
            }
        }
        CanvasCommand::Rename { id, ref name } => {
            {
                let room = room_arc.read().unwrap();
                let Some(canvas_arc) = room.canvases.get(&id) else {
                    return;
                };
                let mut canvas = canvas_arc.write().unwrap();
                canvas.name = name.clone();
            }

            let room = room_arc.read().unwrap();
            if let Some(tx) = &room.tx {
                let _ = tx.send(ServerMessage::CanvasUpdate {
                    command: cmd.clone(),
                });
            }
        }
        CanvasCommand::Switch { .. } => {}
    }
}

pub fn handle_layer_command(
    cmd: LayerCommand,
    room_arc: Arc<std::sync::RwLock<crate::state::RoomState>>,
) {
    match cmd {
        LayerCommand::Create {
            canvas_id,
            layer_id,
            ref name,
        } => {
            {
                let room = room_arc.read().unwrap();
                let Some(canvas_arc) = room.canvases.get(&canvas_id) else {
                    return;
                };
                let mut canvas = canvas_arc.write().unwrap();
                let _ = canvas.get_or_create_layer(layer_id, name.clone());
            }

            let room = room_arc.read().unwrap();
            if let Some(tx) = &room.tx {
                let _ = tx.send(ServerMessage::LayerUpdate {
                    command: cmd.clone(),
                });
            }
        }
        LayerCommand::Delete {
            canvas_id,
            layer_id,
        } => {
            {
                let room = room_arc.read().unwrap();
                let Some(canvas_arc) = room.canvases.get(&canvas_id) else {
                    return;
                };
                let mut canvas = canvas_arc.write().unwrap();
                let _ = canvas.delete_layer(layer_id);
            }

            let room = room_arc.read().unwrap();
            if let Some(tx) = &room.tx {
                let _ = tx.send(ServerMessage::LayerUpdate {
                    command: cmd.clone(),
                });
            }
        }
        LayerCommand::Rename {
            canvas_id,
            layer_id,
            ref name,
        } => {
            {
                let room = room_arc.read().unwrap();
                let Some(canvas_arc) = room.canvases.get(&canvas_id) else {
                    return;
                };
                let canvas = canvas_arc.read().unwrap();
                let Some(layer_arc) = canvas.layers.get(&layer_id) else {
                    return;
                };
                let mut layer = layer_arc.write().unwrap();
                layer.name = name.clone();
            }

            let room = room_arc.read().unwrap();
            if let Some(tx) = &room.tx {
                let _ = tx.send(ServerMessage::LayerUpdate {
                    command: cmd.clone(),
                });
            }
        }
    }
}
