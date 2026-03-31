import type { ShapeData } from '../../../types';
import type { Bounds, Point } from './shapeGeometry';

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const rotateVector = (point: Point, degrees: number): Point => {
  const radians = toRadians(degrees);
  return {
    x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
  };
};

const getBoundsCenter = (bounds: Bounds): Point => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2,
});

const rotatePointAroundCenter = (
  point: Point,
  center: Point,
  degrees: number
): Point => {
  const local = {
    x: point.x - center.x,
    y: point.y - center.y,
  };
  const rotated = rotateVector(local, degrees);
  return {
    x: center.x + rotated.x,
    y: center.y + rotated.y,
  };
};

const getLineWorldPoints = (
  data: Extract<ShapeData, { type: 'line' }>['data']
): Point[] => {
  const origin = {
    x: data.x ?? 0,
    y: data.y ?? 0,
  };
  const scaleX = data.scaleX ?? 1;
  const scaleY = data.scaleY ?? 1;
  const rotation = data.rotation ?? 0;
  const worldPoints: Point[] = [];

  for (let index = 0; index < data.points.length; index += 2) {
    const localPoint = {
      x: data.points[index] * scaleX,
      y: data.points[index + 1] * scaleY,
    };
    const rotatedPoint = rotateVector(localPoint, rotation);
    worldPoints.push({
      x: origin.x + rotatedPoint.x,
      y: origin.y + rotatedPoint.y,
    });
  }

  return worldPoints;
};

const mapPointBetweenBounds = (
  point: Point,
  sourceBounds: Bounds,
  targetBounds: Bounds
): Point => {
  const sourceWidth = Math.max(sourceBounds.width, 1);
  const sourceHeight = Math.max(sourceBounds.height, 1);
  const ratioX = (point.x - sourceBounds.x) / sourceWidth;
  const ratioY = (point.y - sourceBounds.y) / sourceHeight;

  return {
    x: targetBounds.x + ratioX * targetBounds.width,
    y: targetBounds.y + ratioY * targetBounds.height,
  };
};

export const resizeLineFromTransformBounds = (
  shape: Extract<ShapeData, { type: 'line' }>,
  initialBounds: Bounds,
  nextBounds: Bounds
): ShapeData => {
  const rotation = shape.data.rotation ?? 0;
  const initialCenter = getBoundsCenter(initialBounds);
  const nextCenter = getBoundsCenter(nextBounds);
  const worldPoints = getLineWorldPoints(shape.data);

  if (worldPoints.length === 0) {
    return shape;
  }

  const localInitialPoints = worldPoints.map((point) =>
    rotatePointAroundCenter(point, initialCenter, -rotation)
  );
  const localNextPoints = localInitialPoints.map((point) =>
    mapPointBetweenBounds(point, initialBounds, nextBounds)
  );
  const nextWorldPoints = localNextPoints.map((point) =>
    rotatePointAroundCenter(point, nextCenter, rotation)
  );

  const nextLocalPoints: number[] = [];
  nextWorldPoints.forEach((point) => {
    const rotatedBack = rotateVector(
      {
        x: point.x - nextCenter.x,
        y: point.y - nextCenter.y,
      },
      -rotation
    );
    nextLocalPoints.push(rotatedBack.x, rotatedBack.y);
  });

  return {
    type: 'line',
    data: {
      ...shape.data,
      points: nextLocalPoints,
      x: nextCenter.x,
      y: nextCenter.y,
      scaleX: 1,
      scaleY: 1,
      rotation,
    },
  };
};
