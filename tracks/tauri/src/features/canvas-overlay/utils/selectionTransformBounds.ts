import type { ShapeData } from '../../../types';
import type { Bounds, Point, ShapeWithId } from './shapeGeometry';

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const rotateOffset = (offset: Point, degrees: number): Point => {
  const radians = toRadians(degrees);
  return {
    x: offset.x * Math.cos(radians) - offset.y * Math.sin(radians),
    y: offset.x * Math.sin(radians) + offset.y * Math.cos(radians),
  };
};

const getRectLikeTransformBounds = (
  data: {
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
  }
): Bounds => {
  const width = Math.max(1, data.width * Math.abs(data.scaleX ?? 1));
  const height = Math.max(1, data.height * Math.abs(data.scaleY ?? 1));
  const centerOffset = rotateOffset(
    { x: width / 2, y: height / 2 },
    data.rotation ?? 0
  );
  const center = {
    x: data.x + centerOffset.x,
    y: data.y + centerOffset.y,
  };

  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  };
};

const getLineTransformBounds = (
  data: Extract<ShapeData, { type: 'line' }>['data']
): Bounds => {
  const originX = data.x ?? 0;
  const originY = data.y ?? 0;
  const scaleX = Math.abs(data.scaleX ?? 1);
  const scaleY = Math.abs(data.scaleY ?? 1);
  const rotation = data.rotation ?? 0;
  const localXs: number[] = [];
  const localYs: number[] = [];

  for (let index = 0; index < data.points.length; index += 2) {
    localXs.push(data.points[index] * scaleX);
    localYs.push(data.points[index + 1] * scaleY);
  }

  if (localXs.length === 0 || localYs.length === 0) {
    return { x: originX, y: originY, width: 1, height: 1 };
  }

  const minX = Math.min(...localXs);
  const maxX = Math.max(...localXs);
  const minY = Math.min(...localYs);
  const maxY = Math.max(...localYs);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const centerOffset = rotateOffset(
    { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    rotation
  );
  const center = {
    x: originX + centerOffset.x,
    y: originY + centerOffset.y,
  };

  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  };
};

export const getSingleShapeTransformBounds = (shape: ShapeData): Bounds | null => {
  switch (shape.type) {
    case 'line':
      return getLineTransformBounds(shape.data);
    case 'rect':
    case 'image':
      return getRectLikeTransformBounds(shape.data);
    case 'markdown':
      return getRectLikeTransformBounds(shape.data);
    default:
      return null;
  }
};

export const getSelectionTransformBounds = (
  selectedShapes: ShapeWithId[],
  fallbackBounds: Bounds | null
): Bounds | null => {
  if (selectedShapes.length !== 1) return fallbackBounds;

  const singleShape = selectedShapes[0]?.shape;
  if (!singleShape || singleShape.type === 'markdown') {
    return fallbackBounds;
  }

  const rotation = singleShape.data.rotation ?? 0;
  if (Math.abs(rotation) < 0.001) {
    return fallbackBounds;
  }

  return getSingleShapeTransformBounds(singleShape) || fallbackBounds;
};
