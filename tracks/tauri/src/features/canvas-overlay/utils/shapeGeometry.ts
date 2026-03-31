import type { ShapeData } from '../../../types';

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShapeWithId {
  id: string;
  shape: ShapeData;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const rotatePoint = (point: Point, radians: number): Point => ({
  x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
  y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
});

const normalizeLineData = (data: Extract<ShapeData, { type: 'line' }>['data']) => ({
  x: data.x ?? 0,
  y: data.y ?? 0,
  scaleX: data.scaleX ?? 1,
  scaleY: data.scaleY ?? 1,
  rotation: data.rotation ?? 0,
});

const getLineWorldPoints = (
  data: Extract<ShapeData, { type: 'line' }>['data']
): Point[] => {
  const normalized = normalizeLineData(data);
  const radians = toRadians(normalized.rotation);
  const points: Point[] = [];

  for (let index = 0; index < data.points.length; index += 2) {
    const localPoint = {
      x: data.points[index] * normalized.scaleX,
      y: data.points[index + 1] * normalized.scaleY,
    };
    const rotatedPoint = rotatePoint(localPoint, radians);

    points.push({
      x: normalized.x + rotatedPoint.x,
      y: normalized.y + rotatedPoint.y,
    });
  }

  return points;
};

const getBoxWorldPoints = (
  data: {
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
  }
): Point[] => {
  const scaleX = data.scaleX ?? 1;
  const scaleY = data.scaleY ?? 1;
  const radians = toRadians(data.rotation ?? 0);
  const corners = [
    { x: 0, y: 0 },
    { x: data.width * scaleX, y: 0 },
    { x: data.width * scaleX, y: data.height * scaleY },
    { x: 0, y: data.height * scaleY },
  ];

  return corners.map((corner) => {
    const rotatedPoint = rotatePoint(corner, radians);
    return {
      x: data.x + rotatedPoint.x,
      y: data.y + rotatedPoint.y,
    };
  });
};

export const getShapeWorldPoints = (shape: ShapeData): Point[] => {
  switch (shape.type) {
    case 'line':
      return getLineWorldPoints(shape.data);
    case 'rect':
    case 'image':
    case 'markdown':
      return getBoxWorldPoints(shape.data);
    default:
      return [];
  }
};

export const getShapeBounds = (shape: ShapeData): Bounds => {
  const points = getShapeWorldPoints(shape);
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
};

export const normalizeBounds = (bounds: Bounds): Bounds => {
  const x = bounds.width >= 0 ? bounds.x : bounds.x + bounds.width;
  const y = bounds.height >= 0 ? bounds.y : bounds.y + bounds.height;

  return {
    x,
    y,
    width: Math.abs(bounds.width),
    height: Math.abs(bounds.height),
  };
};

export const getSelectionBounds = (shapes: ShapeWithId[]): Bounds | null => {
  if (shapes.length === 0) return null;

  const bounds = shapes.map((shape) => getShapeBounds(shape.shape));
  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
};

export const boundsIntersect = (a: Bounds, b: Bounds): boolean => {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right >= left && bottom >= top;
};

const distanceToSegment = (point: Point, start: Point, end: Point): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const ratio =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const projectedX = start.x + dx * clampedRatio;
  const projectedY = start.y + dy * clampedRatio;

  return Math.hypot(point.x - projectedX, point.y - projectedY);
};

export const hitTestShape = (
  shape: ShapeData,
  point: Point,
  tolerance = 8
): boolean => {
  if (shape.type === 'line') {
    const worldPoints = getLineWorldPoints(shape.data);
    if (worldPoints.length === 1) {
      return distanceToSegment(point, worldPoints[0], worldPoints[0]) <= tolerance;
    }

    for (let index = 0; index < worldPoints.length - 1; index += 1) {
      const start = worldPoints[index];
      const end = worldPoints[index + 1];
      if (
        distanceToSegment(point, start, end) <=
        (shape.data.stroke_width ?? 1) / 2 + tolerance
      ) {
        return true;
      }
    }

    return false;
  }

  const bounds = getShapeBounds(shape);
  return (
    point.x >= bounds.x - tolerance &&
    point.x <= bounds.x + bounds.width + tolerance &&
    point.y >= bounds.y - tolerance &&
    point.y <= bounds.y + bounds.height + tolerance
  );
};

export const hitTestShapes = (
  shapes: ShapeWithId[],
  point: Point,
  tolerance = 8
): ShapeWithId | null => {
  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    const shape = shapes[index];
    if (hitTestShape(shape.shape, point, tolerance)) {
      return shape;
    }
  }

  return null;
};

export const translateShape = (
  shape: ShapeData,
  deltaX: number,
  deltaY: number
): ShapeData => {
  switch (shape.type) {
    case 'line':
      return {
        type: 'line',
        data: {
          ...shape.data,
          x: (shape.data.x ?? 0) + deltaX,
          y: (shape.data.y ?? 0) + deltaY,
        },
      };
    case 'rect':
      return {
        type: 'rect',
        data: {
          ...shape.data,
          x: shape.data.x + deltaX,
          y: shape.data.y + deltaY,
        },
      };
    case 'image':
      return {
        type: 'image',
        data: {
          ...shape.data,
          x: shape.data.x + deltaX,
          y: shape.data.y + deltaY,
        },
      };
    case 'markdown':
      return {
        type: 'markdown',
        data: {
          ...shape.data,
          x: shape.data.x + deltaX,
          y: shape.data.y + deltaY,
        },
      };
    default:
      return shape;
  }
};

const clampDimension = (value: number) => Math.max(24, value);

export const scaleShapeInSelection = (
  shape: ShapeData,
  selectionBounds: Bounds,
  nextSelectionBounds: Bounds
): ShapeData => {
  const safeSelectionWidth = Math.max(selectionBounds.width, 1);
  const safeSelectionHeight = Math.max(selectionBounds.height, 1);
  const scaleX = clampDimension(nextSelectionBounds.width) / safeSelectionWidth;
  const scaleY = clampDimension(nextSelectionBounds.height) / safeSelectionHeight;

  switch (shape.type) {
    case 'line':
      return {
        type: 'line',
        data: {
          ...shape.data,
          x:
            nextSelectionBounds.x +
            ((shape.data.x ?? 0) - selectionBounds.x) * scaleX,
          y:
            nextSelectionBounds.y +
            ((shape.data.y ?? 0) - selectionBounds.y) * scaleY,
          scaleX: (shape.data.scaleX ?? 1) * scaleX,
          scaleY: (shape.data.scaleY ?? 1) * scaleY,
        },
      };
    case 'rect':
      return {
        type: 'rect',
        data: {
          ...shape.data,
          x: nextSelectionBounds.x + (shape.data.x - selectionBounds.x) * scaleX,
          y: nextSelectionBounds.y + (shape.data.y - selectionBounds.y) * scaleY,
          scaleX: (shape.data.scaleX ?? 1) * scaleX,
          scaleY: (shape.data.scaleY ?? 1) * scaleY,
        },
      };
    case 'image':
      return {
        type: 'image',
        data: {
          ...shape.data,
          x: nextSelectionBounds.x + (shape.data.x - selectionBounds.x) * scaleX,
          y: nextSelectionBounds.y + (shape.data.y - selectionBounds.y) * scaleY,
          scaleX: (shape.data.scaleX ?? 1) * scaleX,
          scaleY: (shape.data.scaleY ?? 1) * scaleY,
        },
      };
    case 'markdown':
      return {
        type: 'markdown',
        data: {
          ...shape.data,
          x: nextSelectionBounds.x + (shape.data.x - selectionBounds.x) * scaleX,
          y: nextSelectionBounds.y + (shape.data.y - selectionBounds.y) * scaleY,
          scaleX: (shape.data.scaleX ?? 1) * scaleX,
          scaleY: (shape.data.scaleY ?? 1) * scaleY,
        },
      };
    default:
      return shape;
  }
};

export const getShapesInBounds = (
  shapes: ShapeWithId[],
  selectionBounds: Bounds
): ShapeWithId[] =>
  shapes.filter((shape) => {
    if (shape.shape.type !== 'line') {
      return boundsIntersect(getShapeBounds(shape.shape), selectionBounds);
    }

    const padding = Math.max(0, (shape.shape.data.stroke_width ?? 1) / 2);
    const expandedBounds: Bounds = {
      x: selectionBounds.x - padding,
      y: selectionBounds.y - padding,
      width: selectionBounds.width + padding * 2,
      height: selectionBounds.height + padding * 2,
    };

    const isPointInBounds = (point: Point, bounds: Bounds) =>
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height;

    const orientation = (a: Point, b: Point, c: Point) =>
      (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);

    const onSegment = (a: Point, b: Point, c: Point) =>
      Math.min(a.x, c.x) <= b.x &&
      b.x <= Math.max(a.x, c.x) &&
      Math.min(a.y, c.y) <= b.y &&
      b.y <= Math.max(a.y, c.y);

    const segmentsIntersect = (p1: Point, p2: Point, q1: Point, q2: Point) => {
      const o1 = orientation(p1, p2, q1);
      const o2 = orientation(p1, p2, q2);
      const o3 = orientation(q1, q2, p1);
      const o4 = orientation(q1, q2, p2);
      const epsilon = 1e-9;

      const pStraddles = (o1 > epsilon && o2 < -epsilon) || (o1 < -epsilon && o2 > epsilon);
      const qStraddles = (o3 > epsilon && o4 < -epsilon) || (o3 < -epsilon && o4 > epsilon);
      if (pStraddles && qStraddles) return true;

      if (Math.abs(o1) <= epsilon && onSegment(p1, q1, p2)) return true;
      if (Math.abs(o2) <= epsilon && onSegment(p1, q2, p2)) return true;
      if (Math.abs(o3) <= epsilon && onSegment(q1, p1, q2)) return true;
      if (Math.abs(o4) <= epsilon && onSegment(q1, p2, q2)) return true;

      return false;
    };

    const topLeft = { x: expandedBounds.x, y: expandedBounds.y };
    const topRight = {
      x: expandedBounds.x + expandedBounds.width,
      y: expandedBounds.y,
    };
    const bottomLeft = {
      x: expandedBounds.x,
      y: expandedBounds.y + expandedBounds.height,
    };
    const bottomRight = {
      x: expandedBounds.x + expandedBounds.width,
      y: expandedBounds.y + expandedBounds.height,
    };
    const edges: Array<[Point, Point]> = [
      [topLeft, topRight],
      [topRight, bottomRight],
      [bottomRight, bottomLeft],
      [bottomLeft, topLeft],
    ];

    const points = getLineWorldPoints(shape.shape.data);
    if (points.length === 0) return false;
    if (points.length === 1) {
      return isPointInBounds(points[0], expandedBounds);
    }

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      if (
        isPointInBounds(start, expandedBounds) ||
        isPointInBounds(end, expandedBounds)
      ) {
        return true;
      }

      for (const [edgeStart, edgeEnd] of edges) {
        if (segmentsIntersect(start, end, edgeStart, edgeEnd)) {
          return true;
        }
      }
    }

    return false;
  });
