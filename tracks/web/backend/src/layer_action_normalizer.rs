use std::collections::HashMap;
use std::collections::HashSet;
use uuid::Uuid;
use whiteboard_shared::{Action, ShapeData, UpdateItem};

use crate::shape_policy::normalize_erase_shape_ids;
use crate::shape_resource_refs::fill_shape_resources_if_missing;

pub fn normalize_layer_action(action: Action, visible_shapes: &HashMap<Uuid, ShapeData>) -> Action {
    match action {
        Action::Erase {
            shape_ids,
            force_all_types,
        } => Action::Erase {
            shape_ids: normalize_erase_shape_ids(&shape_ids, visible_shapes, force_all_types),
            force_all_types,
        },
        Action::Update {
            id,
            old_shape,
            new_shape,
        } => Action::Update {
            id,
            old_shape,
            new_shape: fill_shape_resources_if_missing(&id, &new_shape, visible_shapes),
        },
        Action::BatchUpdate { updates } => {
            let filled_updates = updates
                .into_iter()
                .map(|update| UpdateItem {
                    id: update.id,
                    old_shape: update.old_shape,
                    new_shape: fill_shape_resources_if_missing(
                        &update.id,
                        &update.new_shape,
                        visible_shapes,
                    ),
                })
                .collect();

            Action::BatchUpdate {
                updates: filled_updates,
            }
        }
        Action::Reorder { ordered_ids } => {
            let visible_ids: HashSet<Uuid> = visible_shapes.keys().copied().collect();
            let mut seen = HashSet::new();
            let normalized_ids = ordered_ids
                .into_iter()
                .filter(|id| visible_ids.contains(id))
                .filter(|id| seen.insert(*id))
                .collect();

            Action::Reorder {
                ordered_ids: normalized_ids,
            }
        }
        _ => action,
    }
}
