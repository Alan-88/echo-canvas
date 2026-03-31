import type { Bounds, Point } from './shapeGeometry';

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const getSelectionFrameCenter = (bounds: Bounds): Point => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2,
});

export const rotatePointAroundCenter = (
  point: Point,
  center: Point,
  degrees: number
): Point => {
  const radians = toRadians(degrees);
  const translatedX = point.x - center.x;
  const translatedY = point.y - center.y;

  return {
    x: center.x + translatedX * Math.cos(radians) - translatedY * Math.sin(radians),
    y: center.y + translatedX * Math.sin(radians) + translatedY * Math.cos(radians),
  };
};

export const toUnrotatedSelectionPoint = (
  point: Point,
  bounds: Bounds,
  rotationDegrees: number
): Point => {
  if (Math.abs(rotationDegrees) < 0.001) return point;
  return rotatePointAroundCenter(point, getSelectionFrameCenter(bounds), -rotationDegrees);
};

export const hitTestSelectionInterior = (
  point: Point,
  bounds: Bounds | null,
  rotationDegrees: number
) => {
  if (!bounds) return false;

  const localPoint = toUnrotatedSelectionPoint(point, bounds, rotationDegrees);
  return (
    localPoint.x >= bounds.x &&
    localPoint.x <= bounds.x + bounds.width &&
    localPoint.y >= bounds.y &&
    localPoint.y <= bounds.y + bounds.height
  );
};
