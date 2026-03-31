use std::sync::{Arc, RwLock};

use whiteboard_shared::{CanvasCommand, LayerCommand, ServerMessage};

use crate::state::RoomState;

pub fn handle_canvas_command(cmd: CanvasCommand, room_arc: Arc<RwLock<RoomState>>) {
    match cmd {
        CanvasCommand::Create { id, ref name } => {
            println!("🆕 Creating canvas: {} ({})", name, id);
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
            println!("🗑️ Deleting canvas: {}", id);
            {
                let mut room = room_arc.write().unwrap();
                if room.delete_canvas(id) {
                    println!("✅ Canvas {} deleted successfully", id);
                } else {
                    println!("⚠️ Canvas {} not found", id);
                }
            }

            let room = room_arc.read().unwrap();
            if let Some(tx) = &room.tx {
                let _ = tx.send(ServerMessage::CanvasUpdate {
                    command: cmd.clone(),
                });
            }
        }
        CanvasCommand::Rename { id, ref name } => {
            println!("✏️ Renaming canvas: {} to '{}'", id, name);
            {
                let room = room_arc.read().unwrap();
                if let Some(canvas_arc) = room.canvases.get(&id) {
                    let mut canvas = canvas_arc.write().unwrap();
                    canvas.name = name.clone();
                    println!("✅ Canvas {} renamed to '{}'", id, name);
                } else {
                    println!("⚠️ Canvas {} not found", id);
                    return;
                }
            }

            let room = room_arc.read().unwrap();
            if let Some(tx) = &room.tx {
                let _ = tx.send(ServerMessage::CanvasUpdate {
                    command: cmd.clone(),
                });
            }
        }
        CanvasCommand::Switch { id } => {
            println!("🔄 Switch to canvas: {}", id);
        }
    }
}

pub fn handle_layer_command(cmd: LayerCommand, room_arc: Arc<RwLock<RoomState>>) {
    match cmd {
        LayerCommand::Create {
            canvas_id,
            layer_id,
            ref name,
        } => {
            println!(
                "🆕 Creating layer: {} ({}) in canvas {}",
                name, layer_id, canvas_id
            );

            {
                let room = room_arc.read().unwrap();
                if let Some(canvas_arc) = room.canvases.get(&canvas_id) {
                    let mut canvas = canvas_arc.write().unwrap();
                    let _ = canvas.get_or_create_layer(layer_id, name.clone());
                } else {
                    println!("⚠️ Canvas {} not found, cannot create layer", canvas_id);
                    return;
                }
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
            println!("🗑️ Deleting layer: {} in canvas {}", layer_id, canvas_id);

            {
                let room = room_arc.read().unwrap();
                if let Some(canvas_arc) = room.canvases.get(&canvas_id) {
                    let mut canvas = canvas_arc.write().unwrap();
                    if canvas.delete_layer(layer_id) {
                        println!("✅ Layer {} deleted successfully", layer_id);
                    } else {
                        println!("⚠️ Layer {} not found", layer_id);
                    }
                } else {
                    println!("⚠️ Canvas {} not found", canvas_id);
                }
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
            println!(
                "✏️ Renaming layer: {} in canvas {} to '{}'",
                layer_id, canvas_id, name
            );

            {
                let room = room_arc.read().unwrap();
                if let Some(canvas_arc) = room.canvases.get(&canvas_id) {
                    let canvas = canvas_arc.read().unwrap();
                    if let Some(layer_arc) = canvas.layers.get(&layer_id) {
                        let mut layer = layer_arc.write().unwrap();
                        layer.name = name.clone();
                        println!("✅ Layer {} renamed to '{}'", layer_id, name);
                    } else {
                        println!("⚠️ Layer {} not found", layer_id);
                        return;
                    }
                } else {
                    println!("⚠️ Canvas {} not found", canvas_id);
                    return;
                }
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
