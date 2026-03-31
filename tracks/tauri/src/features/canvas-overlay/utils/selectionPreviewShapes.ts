import type { ShapeData } from '../../../types';
import type { ShapeWithId } from './shapeGeometry';

export const mapShapesWithPreview = (
  shapes: ShapeWithId[],
  previewShapes: Map<string, ShapeData>
): ShapeWithId[] =>
  shapes.map((shape) => ({
    id: shape.id,
    shape: previewShapes.get(shape.id) || shape.shape,
  }));
