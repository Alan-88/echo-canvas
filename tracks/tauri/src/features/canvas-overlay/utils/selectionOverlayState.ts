import type { Bounds, ShapeWithId } from './shapeGeometry';

export const getSelectionVisualPadding = (stageScale: number) =>
  10 / Math.max(stageScale, 0.25);

export const expandSelectionBounds = (bounds: Bounds, padding: number): Bounds => ({
  x: bounds.x - padding,
  y: bounds.y - padding,
  width: bounds.width + padding * 2,
  height: bounds.height + padding * 2,
});

export const contractSelectionBounds = (bounds: Bounds, padding: number): Bounds => ({
  x: bounds.x + padding,
  y: bounds.y + padding,
  width: Math.max(1, bounds.width - padding * 2),
  height: Math.max(1, bounds.height - padding * 2),
});

export const getSelectionOverlayRotation = (
  selectedShapes: ShapeWithId[],
  previewRotationDegrees: number | null
) => {
  if (previewRotationDegrees !== null) return previewRotationDegrees;

  if (selectedShapes.length !== 1) return 0;

  const selectedShape = selectedShapes[0]?.shape;
  if (!selectedShape || selectedShape.type === 'markdown') return 0;

  return selectedShape.data.rotation ?? 0;
};
