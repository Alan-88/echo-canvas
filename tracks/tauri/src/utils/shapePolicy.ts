import type { ShapeData } from '../types';

interface ShapeWithIdLike {
  id: string;
  shape: ShapeData;
}

export const getShapeVisualLayerPriority = (shape: ShapeData) => {
  if (shape.type === 'image') return 0;
  if (shape.type === 'markdown') return 1;
  return 2;
};

export const isErasableShape = (shape: ShapeData) =>
  shape.type === 'line' || shape.type === 'rect';

const dedupeIdsInOrder = (shapeIds: string[]): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];

  shapeIds.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      deduped.push(id);
    }
  });

  return deduped;
};

const isLayerWideErase = (
  shapeIds: string[],
  visibleShapes: ShapeWithIdLike[]
): boolean => {
  if (shapeIds.length === 0 || shapeIds.length !== visibleShapes.length) return false;
  const allVisibleIds = new Set(visibleShapes.map((shape) => shape.id));
  return shapeIds.every((id) => allVisibleIds.has(id));
};

export const normalizeEraseShapeIds = (
  shapeIds: string[],
  visibleShapes: ShapeWithIdLike[],
  forceAllTypes = false
): string[] => {
  const deduped = dedupeIdsInOrder(shapeIds);

  if (forceAllTypes) {
    const allVisibleIds = new Set(visibleShapes.map((shape) => shape.id));
    return deduped.filter((id) => allVisibleIds.has(id));
  }

  // Clear 逻辑当前复用 Erase(all ids)，这里保留全量删除语义。
  if (isLayerWideErase(deduped, visibleShapes)) {
    return deduped;
  }

  const erasableIds = new Set(
    visibleShapes
      .filter((shapeWithId) => isErasableShape(shapeWithId.shape))
      .map((shapeWithId) => shapeWithId.id)
  );

  return deduped.filter((id) => erasableIds.has(id));
};

export const orderShapesByVisualLayer = <T extends ShapeWithIdLike>(
  shapes: T[]
): T[] => {
  const imageShapes: T[] = [];
  const markdownShapes: T[] = [];
  const foregroundShapes: T[] = [];

  shapes.forEach((shape) => {
    if (shape.shape.type === 'image') {
      imageShapes.push(shape);
      return;
    }
    if (shape.shape.type === 'markdown') {
      markdownShapes.push(shape);
      return;
    }
    foregroundShapes.push(shape);
  });

  return [...imageShapes, ...markdownShapes, ...foregroundShapes];
};
