use std::collections::{HashMap, HashSet};
use uuid::Uuid;
use whiteboard_shared::{Action, ShapeData};

use crate::shape_policy::normalize_erase_shape_ids;
use crate::shape_resource_refs::fill_shape_resources_if_missing;

pub fn compute_visible_shapes_with_order(
    actions: &[Action],
    pointer: usize,
) -> (Vec<Uuid>, HashMap<Uuid, ShapeData>) {
    let mut shapes: HashMap<Uuid, ShapeData> = HashMap::new();
    let mut ordered_ids: Vec<Uuid> = Vec::new();

    for action in actions.iter().take(pointer) {
        match action {
            Action::Draw { id, shape } => {
                shapes.insert(*id, shape.clone());
                if let Some(index) = ordered_ids
                    .iter()
                    .position(|existing_id| *existing_id == *id)
                {
                    ordered_ids.remove(index);
                }
                ordered_ids.push(*id);
            }
            Action::Erase {
                shape_ids,
                force_all_types,
            } => {
                let filtered_shape_ids =
                    normalize_erase_shape_ids(shape_ids, &shapes, *force_all_types);
                for id in filtered_shape_ids {
                    shapes.remove(&id);
                    if let Some(index) = ordered_ids
                        .iter()
                        .position(|existing_id| *existing_id == id)
                    {
                        ordered_ids.remove(index);
                    }
                }
            }
            Action::Update { id, new_shape, .. } => {
                let updated_shape = fill_shape_resources_if_missing(id, new_shape, &shapes);
                let is_new_shape = !shapes.contains_key(id);
                shapes.insert(*id, updated_shape);
                if is_new_shape {
                    ordered_ids.push(*id);
                }
            }
            Action::BatchUpdate { updates } => {
                for update in updates {
                    let updated_shape =
                        fill_shape_resources_if_missing(&update.id, &update.new_shape, &shapes);
                    let is_new_shape = !shapes.contains_key(&update.id);
                    shapes.insert(update.id, updated_shape);
                    if is_new_shape {
                        ordered_ids.push(update.id);
                    }
                }
            }
            Action::Reorder {
                ordered_ids: requested_order,
            } => {
                if requested_order.is_empty() || ordered_ids.len() <= 1 {
                    continue;
                }

                let mut next_order: Vec<Uuid> = Vec::with_capacity(ordered_ids.len());
                let mut seen = HashSet::new();

                for id in requested_order {
                    if !shapes.contains_key(id) || !seen.insert(*id) {
                        continue;
                    }
                    next_order.push(*id);
                }

                for id in &ordered_ids {
                    if !shapes.contains_key(id) || !seen.insert(*id) {
                        continue;
                    }
                    next_order.push(*id);
                }

                ordered_ids = next_order;
            }
            Action::Clear => {
                shapes.clear();
                ordered_ids.clear();
            }
            _ => {}
        }
    }

    (ordered_ids, shapes)
}

#[cfg(test)]
mod tests {
    use super::compute_visible_shapes_with_order;
    use uuid::Uuid;
    use whiteboard_shared::{Action, ShapeData};

    fn rect_shape(x: f64) -> ShapeData {
        ShapeData::Rect {
            x,
            y: 0.0,
            width: 80.0,
            height: 50.0,
            fill: None,
            stroke: "#111".to_string(),
            rotation: None,
            scale_x: None,
            scale_y: None,
        }
    }

    #[test]
    fn reorder_keeps_requested_ids_first_and_appends_unspecified_ids() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let c = Uuid::new_v4();

        let actions = vec![
            Action::Draw {
                id: a,
                shape: rect_shape(0.0),
            },
            Action::Draw {
                id: b,
                shape: rect_shape(100.0),
            },
            Action::Draw {
                id: c,
                shape: rect_shape(200.0),
            },
            Action::Reorder {
                ordered_ids: vec![c, a],
            },
        ];

        let (ordered_ids, shapes) = compute_visible_shapes_with_order(&actions, actions.len());
        assert_eq!(ordered_ids, vec![c, a, b]);
        assert_eq!(shapes.len(), 3);
    }

    #[test]
    fn pointer_before_reorder_keeps_original_draw_order() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();

        let actions = vec![
            Action::Draw {
                id: a,
                shape: rect_shape(0.0),
            },
            Action::Draw {
                id: b,
                shape: rect_shape(100.0),
            },
            Action::Reorder {
                ordered_ids: vec![b, a],
            },
        ];

        let (ordered_ids, _) = compute_visible_shapes_with_order(&actions, 2);
        assert_eq!(ordered_ids, vec![a, b]);
    }

    #[test]
    fn erase_removes_shape_from_order_and_visibility() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let c = Uuid::new_v4();

        let actions = vec![
            Action::Draw {
                id: a,
                shape: rect_shape(0.0),
            },
            Action::Draw {
                id: b,
                shape: rect_shape(100.0),
            },
            Action::Draw {
                id: c,
                shape: rect_shape(200.0),
            },
            Action::Reorder {
                ordered_ids: vec![c, a, b],
            },
            Action::Erase {
                shape_ids: vec![a],
                force_all_types: true,
            },
        ];

        let (ordered_ids, shapes) = compute_visible_shapes_with_order(&actions, actions.len());
        assert_eq!(ordered_ids, vec![c, b]);
        assert!(shapes.get(&a).is_none());
        assert!(shapes.get(&b).is_some());
        assert!(shapes.get(&c).is_some());
    }
}
