import {
  getShapeBounds,
  getShapeWorldPoints,
  type Bounds,
  type Point,
  type ShapeWithId,
} from './shapeGeometry';

const pointInRect = (point: Point, bounds: Bounds) =>
  point.x >= bounds.x &&
  point.x <= bounds.x + bounds.width &&
  point.y >= bounds.y &&
  point.y <= bounds.y + bounds.height;

const boundsOverlap = (a: Bounds, b: Bounds) =>
  a.x <= b.x + b.width &&
  a.x + a.width >= b.x &&
  a.y <= b.y + b.height &&
  a.y + a.height >= b.y;

const pointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.0000001) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const getPolygonBounds = (points: Point[]): Bounds => {
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

const orientation = (a: Point, b: Point, c: Point) => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 0.000001) return 0;
  return value > 0 ? 1 : 2;
};

const onSegment = (a: Point, b: Point, c: Point) =>
  Math.min(a.x, c.x) <= b.x &&
  b.x <= Math.max(a.x, c.x) &&
  Math.min(a.y, c.y) <= b.y &&
  b.y <= Math.max(a.y, c.y);

const segmentsIntersect = (a1: Point, a2: Point, b1: Point, b2: Point) => {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
};

const getPolygonEdges = (polygon: Point[]) => {
  const edges: Array<[Point, Point]> = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    edges.push([start, end]);
  }
  return edges;
};

const doesRectIntersectPolygon = (rect: Bounds, polygon: Point[]) => {
  if (polygon.length < 3) return false;

  const polygonBounds = getPolygonBounds(polygon);
  if (!boundsOverlap(rect, polygonBounds)) return false;

  if (polygon.some((point) => pointInRect(point, rect))) return true;

  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];

  if (corners.some((corner) => pointInPolygon(corner, polygon))) return true;

  const rectEdges: Array<[Point, Point]> = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];
  const polygonEdges = getPolygonEdges(polygon);

  for (const [ra, rb] of rectEdges) {
    for (const [pa, pb] of polygonEdges) {
      if (segmentsIntersect(ra, rb, pa, pb)) {
        return true;
      }
    }
  }

  return false;
};

const doesPolylineIntersectPolygon = (polyline: Point[], polygon: Point[]) => {
  if (polyline.length === 0 || polygon.length < 3) return false;

  if (polyline.some((point) => pointInPolygon(point, polygon))) return true;

  const polygonEdges = getPolygonEdges(polygon);

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const start = polyline[index];
    const end = polyline[index + 1];
    for (const [pa, pb] of polygonEdges) {
      if (segmentsIntersect(start, end, pa, pb)) return true;
    }
  }

  return false;
};

export const appendLassoPoint = (
  points: Point[],
  point: Point,
  minDistance = 3
): Point[] => {
  if (points.length === 0) return [point];

  const last = points[points.length - 1];
  if (Math.hypot(point.x - last.x, point.y - last.y) < minDistance) {
    return points;
  }

  return [...points, point];
};

export const getShapesInLasso = (
  shapes: ShapeWithId[],
  polygon: Point[]
): ShapeWithId[] => {
  if (polygon.length < 3) return [];

  return shapes.filter((shapeWithId) => {
    const shape = shapeWithId.shape;

    if (shape.type === 'line') {
      return doesPolylineIntersectPolygon(getShapeWorldPoints(shape), polygon);
    }

    return doesRectIntersectPolygon(getShapeBounds(shape), polygon);
  });
};

export const toLassoPath = (points: Point[]) => {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  const segments = rest.map((point) => `L ${point.x} ${point.y}`).join(' ');
  return `M ${first.x} ${first.y} ${segments} Z`;
};
