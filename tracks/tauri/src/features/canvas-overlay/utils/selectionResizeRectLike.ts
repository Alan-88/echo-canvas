import type { ShapeData } from '../../../types';
import type { Bounds, Point } from './shapeGeometry';

interface ShapeResizeMetrics {
  rawWidth: number;
  rawHeight: number;
  rawCenterX: number;
  rawCenterY: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const rotateVector = (point: Point, degrees: number): Point => {
  const radians = toRadians(degrees);
  return {
    x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
  };
};

const getShapeResizeMetrics = (
  shape: Extract<ShapeData, { type: 'rect' | 'image' }>
): ShapeResizeMetrics => ({
  rawWidth: Math.max(1, shape.data.width),
  rawHeight: Math.max(1, shape.data.height),
  rawCenterX: shape.data.width / 2,
  rawCenterY: shape.data.height / 2,
});

const getBoundsCenter = (bounds: Bounds): Point => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2,
});

export const resizeRectLikeShapeFromTransformBounds = (
  shape: Extract<ShapeData, { type: 'rect' | 'image' }>,
  initialBounds: Bounds,
  nextBounds: Bounds
): ShapeData => {
  const metrics = getShapeResizeMetrics(shape);
  const initialCenter = getBoundsCenter(initialBounds);
  const nextCenterLocal = getBoundsCenter(nextBounds);
  const centerDeltaLocal = {
    x: nextCenterLocal.x - initialCenter.x,
    y: nextCenterLocal.y - initialCenter.y,
  };
  const centerDeltaWorld = rotateVector(centerDeltaLocal, shape.data.rotation ?? 0);
  const nextCenter = {
    x: initialCenter.x + centerDeltaWorld.x,
    y: initialCenter.y + centerDeltaWorld.y,
  };
  const nextScaleX = nextBounds.width / metrics.rawWidth;
  const nextScaleY = nextBounds.height / metrics.rawHeight;
  const offset = rotateVector(
    {
      x: metrics.rawCenterX * nextScaleX,
      y: metrics.rawCenterY * nextScaleY,
    },
    shape.data.rotation ?? 0
  );

  if (shape.type === 'rect') {
    return {
      type: 'rect',
      data: {
        ...shape.data,
        x: nextCenter.x - offset.x,
        y: nextCenter.y - offset.y,
        scaleX: nextScaleX,
        scaleY: nextScaleY,
      },
    };
  }

  return {
    type: 'image',
    data: {
      ...shape.data,
      x: nextCenter.x - offset.x,
      y: nextCenter.y - offset.y,
      scaleX: nextScaleX,
      scaleY: nextScaleY,
    },
  };
};
