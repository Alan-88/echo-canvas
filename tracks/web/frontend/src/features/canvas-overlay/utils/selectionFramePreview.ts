import { contractSelectionBounds } from './selectionOverlayState';
import { getResizedSelectionBoundsFromDrag, type ResizeHandle } from './selectionResize';
import type { Bounds, Point } from './shapeGeometry';

export const translateBounds = (
  bounds: Bounds,
  deltaX: number,
  deltaY: number
): Bounds => ({
  x: bounds.x + deltaX,
  y: bounds.y + deltaY,
  width: bounds.width,
  height: bounds.height,
});

export const getScaledSelectionPreview = ({
  displayBounds,
  handle,
  startPointer,
  pointer,
  visualPadding,
  minWidth,
  minHeight,
  keepRatio,
}: {
  displayBounds: Bounds;
  handle: ResizeHandle;
  startPointer: Point;
  pointer: Point;
  visualPadding: number;
  minWidth: number;
  minHeight: number;
  keepRatio?: boolean;
}) => {
  const nextDisplayBounds = getResizedSelectionBoundsFromDrag(
    displayBounds,
    handle,
    startPointer,
    pointer,
    {
      minWidth,
      minHeight,
      keepRatio,
    }
  );

  return {
    displayBounds: nextDisplayBounds,
    selectionBounds: contractSelectionBounds(nextDisplayBounds, visualPadding),
  };
};
