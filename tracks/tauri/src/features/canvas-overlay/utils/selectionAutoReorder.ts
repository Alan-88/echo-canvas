import type { Action, ShapeData } from '../../../types';
import { getShapeVisualLayerPriority } from '../../../utils/shapePolicy';

interface ShapeWithIdLike {
  id: string;
  shape: ShapeData;
}

const dedupeIdsInOrder = (ids: string[]) => {
  const seen = new Set<string>();
  const deduped: string[] = [];

  ids.forEach((id) => {
    if (seen.has(id)) return;
    seen.add(id);
    deduped.push(id);
  });

  return deduped;
};

const moveSelectedToGroupFront = <T extends ShapeWithIdLike>(
  shapes: T[],
  selectedOrder: Map<string, number>
) => {
  const selectedShapes: T[] = [];
  const unselectedShapes: T[] = [];

  shapes.forEach((shape) => {
    if (selectedOrder.has(shape.id)) {
      selectedShapes.push(shape);
      return;
    }
    unselectedShapes.push(shape);
  });

  selectedShapes.sort((left, right) => {
    const leftOrder = selectedOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = selectedOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });

  return [...unselectedShapes, ...selectedShapes];
};

const isSameOrder = (prev: ShapeWithIdLike[], next: ShapeWithIdLike[]) =>
  prev.length === next.length && prev.every((shape, index) => shape.id === next[index]?.id);

export const buildAutoSelectionReorderAction = <T extends ShapeWithIdLike>(
  layerShapes: T[],
  selectedIds: string[]
): Extract<Action, { type: 'reorder' }> | null => {
  if (layerShapes.length <= 1 || selectedIds.length === 0) return null;

  const visibleIds = new Set(layerShapes.map((shape) => shape.id));
  const normalizedSelectedIds = dedupeIdsInOrder(selectedIds).filter((id) => visibleIds.has(id));
  if (normalizedSelectedIds.length === 0) return null;

  const selectedOrder = new Map<string, number>();
  normalizedSelectedIds.forEach((id, index) => {
    selectedOrder.set(id, index);
  });

  const imageShapes: T[] = [];
  const markdownShapes: T[] = [];
  const foregroundShapes: T[] = [];

  layerShapes.forEach((shape) => {
    const priority = getShapeVisualLayerPriority(shape.shape);
    if (priority === 0) {
      imageShapes.push(shape);
      return;
    }
    if (priority === 1) {
      markdownShapes.push(shape);
      return;
    }
    foregroundShapes.push(shape);
  });

  const reordered = [
    ...moveSelectedToGroupFront(imageShapes, selectedOrder),
    ...moveSelectedToGroupFront(markdownShapes, selectedOrder),
    ...moveSelectedToGroupFront(foregroundShapes, selectedOrder),
  ];

  if (isSameOrder(layerShapes, reordered)) return null;

  return {
    type: 'reorder',
    payload: {
      orderedIds: reordered.map((shape) => shape.id),
    },
  };
};
