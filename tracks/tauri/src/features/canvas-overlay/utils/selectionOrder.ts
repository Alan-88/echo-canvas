import type { ShapeData } from '../../../types';
import { getShapeVisualLayerPriority } from '../../../utils/shapePolicy';

export type SelectionApplyMode = 'replace' | 'toggle';

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

export const getSelectionApplyMode = (modifiers: {
  metaKey?: boolean;
  ctrlKey?: boolean;
}): SelectionApplyMode => (modifiers.metaKey || modifiers.ctrlKey ? 'toggle' : 'replace');

export const applySelectionIds = (
  currentIds: string[],
  candidateIds: string[],
  mode: SelectionApplyMode
) => {
  const normalizedCurrentIds = dedupeIdsInOrder(currentIds);
  const normalizedCandidateIds = dedupeIdsInOrder(candidateIds);

  if (mode === 'replace') {
    return normalizedCandidateIds;
  }

  const toggledIds = new Set(normalizedCandidateIds);
  const remainingIds = normalizedCurrentIds.filter((id) => !toggledIds.has(id));
  const currentSet = new Set(normalizedCurrentIds);
  const addedIds = normalizedCandidateIds.filter((id) => !currentSet.has(id));

  return [...remainingIds, ...addedIds];
};

export const orderShapesForSelectionDisplay = <T extends ShapeWithIdLike>(
  shapes: T[],
  selectedIds: string[]
): T[] => {
  const selectedOrder = new Map<string, number>();
  selectedIds.forEach((id, index) => {
    selectedOrder.set(id, index);
  });

  return shapes
    .map((shape, index) => ({
      index,
      shape,
      visualLayer: getShapeVisualLayerPriority(shape.shape),
      selectedOrder: selectedOrder.get(shape.id),
    }))
    .sort((left, right) => {
      if (left.visualLayer !== right.visualLayer) {
        return left.visualLayer - right.visualLayer;
      }

      const leftSelected = typeof left.selectedOrder === 'number';
      const rightSelected = typeof right.selectedOrder === 'number';
      if (leftSelected !== rightSelected) {
        return leftSelected ? 1 : -1;
      }

      if (
        typeof left.selectedOrder === 'number' &&
        typeof right.selectedOrder === 'number' &&
        left.selectedOrder !== right.selectedOrder
      ) {
        return left.selectedOrder - right.selectedOrder;
      }

      return left.index - right.index;
    })
    .map((item) => item.shape);
};
