use crate::layer_snapshot_replay::compute_visible_shapes_with_order;
use whiteboard_shared::Action;

/// 当图层动作数超过该阈值时，保存流程会尝试把“远历史”压缩为基线快照。
const PERSIST_COMPACT_THRESHOLD: usize = 600;
/// 持久化时保留最近的真实动作窗口（用于恢复后继续 Undo/Redo）。
const PERSIST_TAIL_WINDOW: usize = 200;

#[derive(Debug, Clone)]
pub struct CompactedLayerHistory {
    pub actions: Vec<Action>,
    pub pointer: usize,
    pub was_compacted: bool,
}

/// 持久化压缩策略（Hybrid）：
/// - 保留最近 `PERSIST_TAIL_WINDOW` 条真实动作
/// - 更早历史折叠为当前基线 Draw 快照
/// - 保持 `pointer` 映射一致，保证恢复后的当前可见态不变
pub fn compact_layer_history_for_persistence(
    actions: &[Action],
    pointer: usize,
) -> CompactedLayerHistory {
    let safe_pointer = pointer.min(actions.len());

    if actions.len() <= PERSIST_COMPACT_THRESHOLD {
        return CompactedLayerHistory {
            actions: actions.to_vec(),
            pointer: safe_pointer,
            was_compacted: false,
        };
    }

    let checkpoint = safe_pointer.saturating_sub(PERSIST_TAIL_WINDOW);
    if checkpoint == 0 {
        return CompactedLayerHistory {
            actions: actions.to_vec(),
            pointer: safe_pointer,
            was_compacted: false,
        };
    }

    let (visible_order, mut visible_shapes) =
        compute_visible_shapes_with_order(actions, checkpoint);
    let mut compacted_actions =
        Vec::with_capacity(visible_order.len() + actions.len() - checkpoint);

    for id in visible_order {
        if let Some(shape) = visible_shapes.remove(&id) {
            compacted_actions.push(Action::Draw { id, shape });
        }
    }

    let baseline_len = compacted_actions.len();
    compacted_actions.extend_from_slice(&actions[checkpoint..]);
    let compacted_pointer = baseline_len + (safe_pointer - checkpoint);

    if compacted_actions.len() >= actions.len() {
        return CompactedLayerHistory {
            actions: actions.to_vec(),
            pointer: safe_pointer,
            was_compacted: false,
        };
    }

    CompactedLayerHistory {
        actions: compacted_actions,
        pointer: compacted_pointer,
        was_compacted: true,
    }
}

#[cfg(test)]
mod tests {
    use super::compact_layer_history_for_persistence;
    use crate::layer_snapshot_replay::compute_visible_shapes_with_order;
    use std::collections::HashMap;
    use uuid::Uuid;
    use whiteboard_shared::{Action, ShapeData};

    fn line(points: Vec<f64>) -> ShapeData {
        ShapeData::Line {
            points,
            stroke: "#111".to_string(),
            stroke_width: 2.0,
            x: None,
            y: None,
            rotation: None,
            scale_x: None,
            scale_y: None,
        }
    }

    fn build_long_history() -> (Vec<Action>, usize) {
        let mut actions = Vec::new();
        let mut ids = Vec::new();

        for i in 0..30 {
            let id = Uuid::new_v4();
            ids.push(id);
            actions.push(Action::Draw {
                id,
                shape: line(vec![i as f64, 0.0, i as f64 + 1.0, 1.0]),
            });
        }

        // 重排一次，确保顺序语义也能保留
        let mut reordered = ids.clone();
        reordered.reverse();
        actions.push(Action::Reorder {
            ordered_ids: reordered,
        });

        let target_id = ids[0];
        let mut current_shape = line(vec![0.0, 0.0, 1.0, 1.0]);
        // 大量 Update，构造“动作很多但可见图形较少”的场景
        for i in 0..720 {
            let next_shape = line(vec![i as f64, 0.0, i as f64 + 2.0, 2.0]);
            actions.push(Action::Update {
                id: target_id,
                old_shape: current_shape.clone(),
                new_shape: next_shape.clone(),
            });
            current_shape = next_shape;
        }

        // 添加一些 redo 尾部场景
        for i in 0..20 {
            let id = Uuid::new_v4();
            actions.push(Action::Draw {
                id,
                shape: line(vec![1000.0 + i as f64, 0.0, 1010.0 + i as f64, 1.0]),
            });
        }

        // 让 pointer 停在尾部前 5 步，模拟可 redo 场景
        let pointer = actions.len() - 5;
        (actions, pointer)
    }

    fn shapes_signature(shapes: HashMap<Uuid, ShapeData>) -> Vec<(String, String)> {
        let mut signature: Vec<(String, String)> = shapes
            .into_iter()
            .map(|(id, shape)| {
                (
                    id.to_string(),
                    serde_json::to_string(&shape).expect("shape should serialize"),
                )
            })
            .collect();
        signature.sort_by(|a, b| a.0.cmp(&b.0));
        signature
    }

    #[test]
    fn compaction_preserves_current_and_redo_visible_state() {
        let (actions, pointer) = build_long_history();
        let compacted = compact_layer_history_for_persistence(&actions, pointer);
        assert!(compacted.was_compacted);
        assert!(compacted.actions.len() < actions.len());

        let (origin_order_now, origin_shapes_now) =
            compute_visible_shapes_with_order(&actions, pointer);
        let (next_order_now, next_shapes_now) =
            compute_visible_shapes_with_order(&compacted.actions, compacted.pointer);
        assert_eq!(origin_order_now, next_order_now);
        assert_eq!(
            shapes_signature(origin_shapes_now),
            shapes_signature(next_shapes_now)
        );

        let (origin_order_full, origin_shapes_full) =
            compute_visible_shapes_with_order(&actions, actions.len());
        let (next_order_full, next_shapes_full) =
            compute_visible_shapes_with_order(&compacted.actions, compacted.actions.len());
        assert_eq!(origin_order_full, next_order_full);
        assert_eq!(
            shapes_signature(origin_shapes_full),
            shapes_signature(next_shapes_full)
        );
    }

    #[test]
    fn short_history_keeps_original_actions() {
        let id = Uuid::new_v4();
        let actions = vec![Action::Draw {
            id,
            shape: line(vec![0.0, 0.0, 10.0, 10.0]),
        }];
        let compacted = compact_layer_history_for_persistence(&actions, 1);
        assert!(!compacted.was_compacted);
        assert_eq!(compacted.pointer, 1);
        assert_eq!(compacted.actions.len(), 1);
    }
}
