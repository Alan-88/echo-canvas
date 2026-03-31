import { isErasableShape } from '../../../utils/shapePolicy';
import { hitTestShape, type Point, type ShapeWithId } from './shapeGeometry';

const getEraserRadiusTolerance = (tolerance: number): number =>
  Math.max(2, tolerance * 0.5);

export const collectErasableShapeIdsAtPoint = ({
  point,
  shapes,
  tolerance,
  previousIds,
}: {
  point: Point;
  shapes: ShapeWithId[];
  tolerance: number;
  previousIds: Set<string>;
}): Set<string> => {
  const nextIds = new Set(previousIds);
  const eraserRadiusTolerance = getEraserRadiusTolerance(tolerance);

  shapes.forEach((shapeWithId) => {
    if (!isErasableShape(shapeWithId.shape)) {
      return;
    }

    if (hitTestShape(shapeWithId.shape, point, eraserRadiusTolerance)) {
      nextIds.add(shapeWithId.id);
    }
  });

  return nextIds;
};
