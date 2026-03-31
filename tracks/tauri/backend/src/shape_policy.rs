use std::collections::{HashMap, HashSet};
use uuid::Uuid;
use whiteboard_shared::ShapeData;

pub fn is_erasable_shape(shape: &ShapeData) -> bool {
    matches!(shape, ShapeData::Line { .. } | ShapeData::Rect { .. })
}

fn dedupe_ids_in_order(shape_ids: &[Uuid]) -> Vec<Uuid> {
    let mut seen = HashSet::new();
    let mut deduped = Vec::with_capacity(shape_ids.len());

    for id in shape_ids {
        if seen.insert(*id) {
            deduped.push(*id);
        }
    }

    deduped
}

fn is_layer_wide_erase(shape_ids: &[Uuid], visible_shapes: &HashMap<Uuid, ShapeData>) -> bool {
    !shape_ids.is_empty()
        && shape_ids.len() == visible_shapes.len()
        && shape_ids.iter().all(|id| visible_shapes.contains_key(id))
}

pub fn normalize_erase_shape_ids(
    shape_ids: &[Uuid],
    visible_shapes: &HashMap<Uuid, ShapeData>,
    force_all_types: bool,
) -> Vec<Uuid> {
    let deduped = dedupe_ids_in_order(shape_ids);

    if force_all_types {
        return deduped
            .into_iter()
            .filter(|id| visible_shapes.contains_key(id))
            .collect();
    }

    // Clear 逻辑当前复用 Erase(all ids)，这里保留全量删除语义。
    if is_layer_wide_erase(&deduped, visible_shapes) {
        return deduped;
    }

    let erasable_ids: HashSet<Uuid> = visible_shapes
        .iter()
        .filter_map(|(id, shape)| is_erasable_shape(shape).then_some(*id))
        .collect();

    deduped
        .into_iter()
        .filter(|id| erasable_ids.contains(id))
        .collect()
}
