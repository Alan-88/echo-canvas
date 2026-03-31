use crate::resource_snapshot::ResourceSnapshot;
use crate::shape_resource_refs::hydrate_action_from_resources;
use crate::state::{CanvasState, LayerState, RoomState};
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use whiteboard_shared::Action;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomSnapshot {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub restore_token: Option<String>,
    pub original_room_id: String,
    pub saved_at: String,
    pub canvases: IndexMap<uuid::Uuid, CanvasSnapshot>,
    #[serde(default)]
    #[serde(skip_serializing_if = "IndexMap::is_empty")]
    pub resources: IndexMap<String, ResourceSnapshot>,
    pub metadata: SaveMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveMetadata {
    #[serde(default)]
    pub canvas_count: usize,
    #[serde(default)]
    pub total_shapes: usize,
    #[serde(default)]
    pub total_resources: usize,
    #[serde(default)]
    pub unique_resources: usize,
    #[serde(default)]
    pub total_resource_bytes: usize,
    #[serde(default)]
    pub unique_resource_bytes: usize,
    #[serde(default)]
    pub snapshot_inline_payloads_stripped: usize,
    #[serde(default)]
    pub snapshot_inline_bytes_stripped: usize,
    #[serde(default = "default_save_count")]
    pub save_count: usize,
}

fn default_save_count() -> usize {
    1
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasSnapshot {
    pub id: uuid::Uuid,
    pub name: String,
    pub layers: IndexMap<uuid::Uuid, LayerSnapshot>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerSnapshot {
    pub id: uuid::Uuid,
    pub name: String,
    pub actions: Vec<Action>,
    pub pointer: usize,
}

impl RoomSnapshot {
    pub fn from_room_state(room: &RoomState, restore_token: String, save_count: usize) -> Self {
        let snapshot = crate::persistence_snapshot_builder::build_canvas_snapshots(room);

        Self {
            restore_token: Some(restore_token),
            original_room_id: room.room_id.clone(),
            saved_at: chrono::Utc::now().to_rfc3339(),
            canvases: snapshot.canvases,
            resources: snapshot.resources,
            metadata: SaveMetadata {
                canvas_count: room.canvases.len(),
                total_shapes: snapshot.total_shapes,
                total_resources: snapshot.resource_stats.total_resources,
                unique_resources: snapshot.resource_stats.unique_resources,
                total_resource_bytes: snapshot.resource_stats.total_resource_bytes,
                unique_resource_bytes: snapshot.resource_stats.unique_resource_bytes,
                snapshot_inline_payloads_stripped: snapshot
                    .stripped_inline_payload_stats
                    .total_payloads,
                snapshot_inline_bytes_stripped: snapshot
                    .stripped_inline_payload_stats
                    .total_payload_bytes,
                save_count,
            },
        }
    }

    pub fn from_room_state_no_token(room: &RoomState) -> Self {
        let snapshot = crate::persistence_snapshot_builder::build_canvas_snapshots(room);

        Self {
            restore_token: None,
            original_room_id: room.room_id.clone(),
            saved_at: chrono::Utc::now().to_rfc3339(),
            canvases: snapshot.canvases,
            resources: snapshot.resources,
            metadata: SaveMetadata {
                canvas_count: room.canvases.len(),
                total_shapes: snapshot.total_shapes,
                total_resources: snapshot.resource_stats.total_resources,
                unique_resources: snapshot.resource_stats.unique_resources,
                total_resource_bytes: snapshot.resource_stats.total_resource_bytes,
                unique_resource_bytes: snapshot.resource_stats.unique_resource_bytes,
                snapshot_inline_payloads_stripped: snapshot
                    .stripped_inline_payload_stats
                    .total_payloads,
                snapshot_inline_bytes_stripped: snapshot
                    .stripped_inline_payload_stats
                    .total_payload_bytes,
                save_count: 1,
            },
        }
    }

    pub fn to_room_state(&self, new_room_id: String, restore_token: String) -> RoomState {
        restore_room_snapshot(self, new_room_id, Some(restore_token))
    }

    pub fn to_room_state_without_token(&self, new_room_id: String) -> RoomState {
        restore_room_snapshot(self, new_room_id, None)
    }
}

fn restore_room_snapshot(
    snapshot: &RoomSnapshot,
    new_room_id: String,
    restore_token: Option<String>,
) -> RoomState {
    let (tx, _rx) = tokio::sync::broadcast::channel(100);
    let mut canvases = IndexMap::new();

    for (canvas_id, canvas_snapshot) in &snapshot.canvases {
        let mut layers = IndexMap::new();

        for (layer_id, layer_snapshot) in &canvas_snapshot.layers {
            let layer = LayerState {
                id: layer_snapshot.id,
                name: layer_snapshot.name.clone(),
                actions: layer_snapshot
                    .actions
                    .iter()
                    .map(|action| hydrate_action_from_resources(action, &snapshot.resources))
                    .collect(),
                pointer: layer_snapshot.pointer.min(layer_snapshot.actions.len()),
            };

            layers.insert(
                *layer_id,
                std::sync::Arc::new(std::sync::RwLock::new(layer)),
            );
        }

        let canvas = CanvasState {
            id: *canvas_id,
            name: canvas_snapshot.name.clone(),
            layers,
        };

        canvases.insert(
            *canvas_id,
            std::sync::Arc::new(std::sync::RwLock::new(canvas)),
        );
    }

    let last_activity_timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs();

    RoomState {
        room_id: new_room_id,
        canvases,
        tx: Some(tx),
        associated_restore_token: restore_token,
        last_activity_timestamp,
    }
}
