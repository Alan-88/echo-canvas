import type { Point } from './shapeGeometry';

const MIN_DRAG_DISTANCE_PX = 6;

export const hasPointerMovedEnoughForMarquee = ({
  startPoint,
  currentPoint,
  stageScale,
}: {
  startPoint: Point;
  currentPoint: Point;
  stageScale: number;
}) => {
  const threshold = MIN_DRAG_DISTANCE_PX / Math.max(stageScale, 0.25);
  const deltaX = currentPoint.x - startPoint.x;
  const deltaY = currentPoint.y - startPoint.y;
  return deltaX * deltaX + deltaY * deltaY >= threshold * threshold;
};
