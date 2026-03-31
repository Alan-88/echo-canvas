import type { Point } from './shapeGeometry';

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const rotateVector = (vector: Point, degrees: number): Point => {
  const radians = toRadians(degrees);
  return {
    x: vector.x * Math.cos(radians) - vector.y * Math.sin(radians),
    y: vector.x * Math.sin(radians) + vector.y * Math.cos(radians),
  };
};

export const getSelectionLocalPointerFromWorldDelta = ({
  startLocalPoint,
  startWorldPoint,
  currentWorldPoint,
  rotationDegrees,
}: {
  startLocalPoint: Point;
  startWorldPoint: Point;
  currentWorldPoint: Point;
  rotationDegrees: number;
}): Point => {
  const worldDelta = {
    x: currentWorldPoint.x - startWorldPoint.x,
    y: currentWorldPoint.y - startWorldPoint.y,
  };
  const localDelta = rotateVector(worldDelta, -rotationDegrees);

  return {
    x: startLocalPoint.x + localDelta.x,
    y: startLocalPoint.y + localDelta.y,
  };
};
