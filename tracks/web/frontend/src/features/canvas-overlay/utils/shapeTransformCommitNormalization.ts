import type { ShapeData } from '../../../types';

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const rotateVector = (x: number, y: number, degrees: number) => {
  const radians = toRadians(degrees);
  return {
    x: x * Math.cos(radians) - y * Math.sin(radians),
    y: x * Math.sin(radians) + y * Math.cos(radians),
  };
};

const normalizeLineShapeTransform = (
  shape: Extract<ShapeData, { type: 'line' }>
): ShapeData => {
  const rotation = shape.data.rotation ?? 0;
  const scaleX = shape.data.scaleX ?? 1;
  const scaleY = shape.data.scaleY ?? 1;
  const originX = shape.data.x ?? 0;
  const originY = shape.data.y ?? 0;
  const needsNormalization =
    Math.abs(rotation) > 0.001 ||
    Math.abs(scaleX - 1) > 0.001 ||
    Math.abs(scaleY - 1) > 0.001;

  if (!needsNormalization) {
    return shape;
  }

  const worldPoints: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];

  for (let index = 0; index < shape.data.points.length; index += 2) {
    const scaledX = shape.data.points[index] * scaleX;
    const scaledY = shape.data.points[index + 1] * scaleY;
    const rotated = rotateVector(scaledX, scaledY, rotation);
    const worldX = originX + rotated.x;
    const worldY = originY + rotated.y;
    worldPoints.push(worldX, worldY);
    xs.push(worldX);
    ys.push(worldY);
  }

  if (worldPoints.length === 0) {
    return {
      type: 'line',
      data: {
        ...shape.data,
        x: originX,
        y: originY,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
    };
  }

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const normalizedPoints: number[] = [];
  for (let index = 0; index < worldPoints.length; index += 2) {
    normalizedPoints.push(worldPoints[index] - minX, worldPoints[index + 1] - minY);
  }

  return {
    type: 'line',
    data: {
      ...shape.data,
      points: normalizedPoints,
      x: minX,
      y: minY,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
  };
};

const normalizeRectLikeShapeTransform = (
  shape: Extract<ShapeData, { type: 'rect' | 'image' }>
): ShapeData => {
  const scaleX = shape.data.scaleX ?? 1;
  const scaleY = shape.data.scaleY ?? 1;
  const needsNormalization =
    Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001;

  if (!needsNormalization) {
    return shape;
  }

  if (scaleX <= 0 || scaleY <= 0) {
    return shape;
  }

  const width = Math.max(1, shape.data.width * scaleX);
  const height = Math.max(1, shape.data.height * scaleY);

  if (shape.type === 'rect') {
    return {
      type: 'rect',
      data: {
        ...shape.data,
        width,
        height,
        scaleX: 1,
        scaleY: 1,
      },
    };
  }

  return {
    type: 'image',
    data: {
      ...shape.data,
      width,
      height,
      scaleX: 1,
      scaleY: 1,
    },
  };
};

export const normalizeCommittedShapeTransform = (shape: ShapeData): ShapeData => {
  if (shape.type === 'line') {
    return normalizeLineShapeTransform(shape);
  }

  if (shape.type === 'rect' || shape.type === 'image') {
    return normalizeRectLikeShapeTransform(shape);
  }

  return shape;
};
