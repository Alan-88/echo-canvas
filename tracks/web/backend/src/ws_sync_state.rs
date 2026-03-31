use std::collections::HashMap;

use whiteboard_shared::{CanvasView, LayerView, ServerMessage};

use crate::state::RoomState;

pub fn build_sync_state_message(room: &RoomState) -> ServerMessage {
    let mut canvas_views = HashMap::new();
    let mut canvas_ids = Vec::new();

    println!("📊 Building SyncState for room: {}", room.room_id);
    println!("   Total canvases: {}", room.canvases.len());

    for (canvas_id, canvas_arc) in room.canvases.iter() {
        let canvas = canvas_arc.read().unwrap();
        let mut layer_views = HashMap::new();
        let mut layer_ids = Vec::new();

        println!(
            "   📦 Canvas: {} ({}), layers: {}",
            canvas.name,
            canvas.id,
            canvas.layers.len()
        );

        for (layer_id, layer_arc) in canvas.layers.iter() {
            let layer = layer_arc.read().unwrap();
            println!(
                "      📄 Layer: {} ({}), pointer: {}, history: {}",
                layer.name,
                layer.id,
                layer.pointer,
                layer.actions.len()
            );

            layer_views.insert(
                *layer_id,
                LayerView {
                    id: layer.id,
                    name: layer.name.clone(),
                    pointer: layer.pointer,
                    history: layer.actions.clone(),
                },
            );
            layer_ids.push(*layer_id);
        }

        canvas_views.insert(
            *canvas_id,
            CanvasView {
                id: canvas.id,
                name: canvas.name.clone(),
                layers: layer_views,
                layer_ids,
            },
        );
        canvas_ids.push(*canvas_id);
    }

    let sync_msg = ServerMessage::SyncState {
        room_id: room.room_id.clone(),
        canvases: canvas_views,
        canvas_ids,
        restore_token: room.associated_restore_token.clone(),
    };

    match serde_json::to_string(&sync_msg) {
        Ok(json) => println!("📤 SyncState JSON length: {} bytes", json.len()),
        Err(e) => println!("⚠️ Failed to estimate SyncState JSON size: {}", e),
    }

    sync_msg
}
