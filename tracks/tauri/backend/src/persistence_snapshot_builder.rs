use indexmap::IndexMap;
use uuid::Uuid;

use crate::layer_persistence_compaction::compact_layer_history_for_persistence;
use crate::layer_snapshot_replay::compute_visible_shapes_with_order;
use crate::persistence::{CanvasSnapshot, LayerSnapshot};
use crate::resource_inventory::{
    collect_action_inline_resource_payload_stats, collect_action_resource_catalog,
    InlineResourcePayloadStats, ResourceInventoryCollector, ResourceInventoryStats,
};
use crate::resource_snapshot::{merge_resource_catalog, ResourceSnapshot};
use crate::shape_resource_refs::{
    attach_action_resource_refs, strip_action_inline_resources_for_snapshot,
};
use crate::state::RoomState;

pub struct SnapshotBuildResult {
    pub canvases: IndexMap<Uuid, CanvasSnapshot>,
    pub resources: IndexMap<String, ResourceSnapshot>,
    pub total_shapes: usize,
    pub resource_stats: ResourceInventoryStats,
    pub stripped_inline_payload_stats: InlineResourcePayloadStats,
}

pub fn build_canvas_snapshots(room: &RoomState) -> SnapshotBuildResult {
    let mut canvases = IndexMap::new();
    let mut total_shapes = 0;
    let mut compacted_layer_count = 0usize;
    let mut resource_collector = ResourceInventoryCollector::default();
    let mut resource_snapshots = IndexMap::<String, ResourceSnapshot>::new();
    let mut stripped_inline_payload_stats = InlineResourcePayloadStats::default();

    for (canvas_id, canvas_arc) in &room.canvases {
        let canvas = canvas_arc.read().unwrap();
        let mut layers = IndexMap::new();

        for (layer_id, layer_arc) in &canvas.layers {
            let layer = layer_arc.read().unwrap();
            let compacted = compact_layer_history_for_persistence(&layer.actions, layer.pointer);
            let attached_actions = compacted
                .actions
                .iter()
                .map(attach_action_resource_refs)
                .collect::<Vec<_>>();
            let action_payload_stats =
                collect_action_inline_resource_payload_stats(attached_actions.iter());
            let snapshot_actions = attached_actions
                .iter()
                .map(strip_action_inline_resources_for_snapshot)
                .collect::<Vec<_>>();
            stripped_inline_payload_stats.total_payloads += action_payload_stats.total_payloads;
            stripped_inline_payload_stats.total_payload_bytes +=
                action_payload_stats.total_payload_bytes;

            if compacted.was_compacted {
                compacted_layer_count += 1;
            }

            let (_ordered_ids, visible_shapes) =
                compute_visible_shapes_with_order(&compacted.actions, compacted.pointer);
            total_shapes += visible_shapes.len();

            for shape in visible_shapes.values() {
                resource_collector.add_shape(shape);
            }

            merge_resource_catalog(
                &mut resource_snapshots,
                collect_action_resource_catalog(attached_actions.iter()),
            );

            layers.insert(
                *layer_id,
                LayerSnapshot {
                    id: layer.id,
                    name: layer.name.clone(),
                    actions: snapshot_actions,
                    pointer: compacted.pointer,
                },
            );
        }

        canvases.insert(
            *canvas_id,
            CanvasSnapshot {
                id: canvas.id,
                name: canvas.name.clone(),
                layers,
            },
        );
    }

    if compacted_layer_count > 0 {
        println!(
            "[Persistence] Hybrid compaction applied to {} layer(s)",
            compacted_layer_count
        );
    }

    SnapshotBuildResult {
        canvases,
        resources: resource_snapshots,
        total_shapes,
        resource_stats: resource_collector.into_stats(),
        stripped_inline_payload_stats,
    }
}
