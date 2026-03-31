import { getTransformerConfig } from '../../../utils/shapeTransformUpdates';
import type { ShapeData } from '../../../types';
import type { Bounds, Point, ShapeWithId } from './shapeGeometry';

export interface RotationHandlePosition {
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
}

const ROTATION_HANDLE_OFFSET = 28;

const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const rotatePointAroundCenter = (point: Point, center: Point, deltaRadians: number): Point => {
  const translatedX = point.x - center.x;
  const translatedY = point.y - center.y;

  return {
    x: center.x + translatedX * Math.cos(deltaRadians) - translatedY * Math.sin(deltaRadians),
    y: center.y + translatedX * Math.sin(deltaRadians) + translatedY * Math.cos(deltaRadians),
  };
};

export const canRotateSelection = (selectedShapes: ShapeWithId[]) =>
  getTransformerConfig(selectedShapes.map((shape) => ({ shape: shape.shape }))).rotateEnabled;

export const getSelectionCenter = (bounds: Bounds): Point => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2,
});

export const getRotationHandlePosition = (
  bounds: Bounds
): RotationHandlePosition => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y - ROTATION_HANDLE_OFFSET,
  anchorX: bounds.x + bounds.width / 2,
  anchorY: bounds.y,
});

export const hitTestRotationHandle = (
  bounds: Bounds | null,
  point: Point,
  stageScale: number
) => {
  if (!bounds) return false;

  const handle = getRotationHandlePosition(bounds);
  const radius = 8 / Math.max(stageScale, 0.25);

  return (
    point.x >= handle.x - radius &&
    point.x <= handle.x + radius &&
    point.y >= handle.y - radius &&
    point.y <= handle.y + radius
  );
};

export const getRotationAngleDelta = (
  center: Point,
  startPoint: Point,
  currentPoint: Point
) => {
  const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
  const currentAngle = Math.atan2(currentPoint.y - center.y, currentPoint.x - center.x);
  return currentAngle - startAngle;
};

export const rotateShapeAroundSelectionCenter = (
  shape: ShapeData,
  selectionBounds: Bounds,
  deltaRadians: number
): ShapeData => {
  const center = getSelectionCenter(selectionBounds);
  const deltaDegrees = toDegrees(deltaRadians);

  switch (shape.type) {
    case 'line': {
      const origin = {
        x: shape.data.x ?? 0,
        y: shape.data.y ?? 0,
      };
      const rotatedOrigin = rotatePointAroundCenter(origin, center, deltaRadians);
      return {
        type: 'line',
        data: {
          ...shape.data,
          x: rotatedOrigin.x,
          y: rotatedOrigin.y,
          rotation: (shape.data.rotation ?? 0) + deltaDegrees,
        },
      };
    }
    case 'rect': {
      const rotatedOrigin = rotatePointAroundCenter(
        { x: shape.data.x, y: shape.data.y },
        center,
        deltaRadians
      );
      return {
        type: 'rect',
        data: {
          ...shape.data,
          x: rotatedOrigin.x,
          y: rotatedOrigin.y,
          rotation: (shape.data.rotation ?? 0) + deltaDegrees,
        },
      };
    }
    case 'image': {
      const rotatedOrigin = rotatePointAroundCenter(
        { x: shape.data.x, y: shape.data.y },
        center,
        deltaRadians
      );
      return {
        type: 'image',
        data: {
          ...shape.data,
          x: rotatedOrigin.x,
          y: rotatedOrigin.y,
          rotation: (shape.data.rotation ?? 0) + deltaDegrees,
        },
      };
    }
    case 'markdown':
      return shape;
    default:
      return shape;
  }
};

export const normalizeRotationDegrees = (degrees: number) => {
  const turns = degrees % 360;
  if (turns < 0) return turns + 360;
  return turns;
};

export const snapRotationRadians = (deltaRadians: number, snapStepDegrees = 15) => {
  const stepRadians = toRadians(snapStepDegrees);
  return Math.round(deltaRadians / stepRadians) * stepRadians;
};
