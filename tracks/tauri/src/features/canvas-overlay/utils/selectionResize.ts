import { getTransformerConfig } from '../../../utils/shapeTransformUpdates';
import {
  MIN_MARKDOWN_HEIGHT,
  MIN_MARKDOWN_WIDTH,
} from '../../../utils/markdownShapePersistence';
import type { ShapeData } from '../../../types';
import { scaleShapeInSelection, type Bounds, type Point, type ShapeWithId } from './shapeGeometry';
import { resizeLineFromTransformBounds } from './selectionResizeLine';
import { resizeRectLikeShapeFromTransformBounds } from './selectionResizeRectLike';

export type ResizeHandle =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface HandlePosition {
  handle: ResizeHandle;
  x: number;
  y: number;
}

const ALL_HANDLES: ResizeHandle[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const buildHandlePositions = (bounds: Bounds): Record<ResizeHandle, Point> => ({
  'top-left': { x: bounds.x, y: bounds.y },
  'top-center': { x: bounds.x + bounds.width / 2, y: bounds.y },
  'top-right': { x: bounds.x + bounds.width, y: bounds.y },
  'middle-left': { x: bounds.x, y: bounds.y + bounds.height / 2 },
  'middle-right': { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
  'bottom-left': { x: bounds.x, y: bounds.y + bounds.height },
  'bottom-center': { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
  'bottom-right': { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
});

export const getEnabledResizeHandles = (selectedShapes: ShapeWithId[]): ResizeHandle[] => {
  const config = getTransformerConfig(selectedShapes.map((shape) => ({ shape: shape.shape })));
  return (config.enabledAnchors as ResizeHandle[]) || [];
};

export const getHandlePositions = (
  bounds: Bounds,
  handles: ResizeHandle[]
): HandlePosition[] => {
  const positions = buildHandlePositions(bounds);
  return handles.map((handle) => ({ handle, ...positions[handle] }));
};

export const getResizeHandleAtPoint = (
  bounds: Bounds | null,
  point: Point,
  stageScale: number,
  handles: ResizeHandle[]
): ResizeHandle | null => {
  if (!bounds || handles.length === 0) return null;

  const handleRadius = 8 / Math.max(stageScale, 0.25);
  const positions = buildHandlePositions(bounds);

  for (const handle of handles) {
    const position = positions[handle];
    if (
      point.x >= position.x - handleRadius &&
      point.x <= position.x + handleRadius &&
      point.y >= position.y - handleRadius &&
      point.y <= position.y + handleRadius
    ) {
      return handle;
    }
  }

  return null;
};

export const isCornerResizeHandle = (handle: ResizeHandle) =>
  handle === 'top-left' ||
  handle === 'top-right' ||
  handle === 'bottom-left' ||
  handle === 'bottom-right';

const hasHorizontalResize = (handle: ResizeHandle) =>
  handle === 'top-left' ||
  handle === 'middle-left' ||
  handle === 'bottom-left' ||
  handle === 'top-right' ||
  handle === 'middle-right' ||
  handle === 'bottom-right';

const hasVerticalResize = (handle: ResizeHandle) =>
  handle === 'top-left' ||
  handle === 'top-center' ||
  handle === 'top-right' ||
  handle === 'bottom-left' ||
  handle === 'bottom-center' ||
  handle === 'bottom-right';

const isLeftHandle = (handle: ResizeHandle) =>
  handle === 'top-left' || handle === 'middle-left' || handle === 'bottom-left';

const isTopHandle = (handle: ResizeHandle) =>
  handle === 'top-left' || handle === 'top-center' || handle === 'top-right';

const getAspectRatio = (bounds: Bounds) =>
  bounds.height === 0 ? 1 : bounds.width / bounds.height;

export const getResizedSelectionBoundsFromDrag = (
  initialBounds: Bounds,
  handle: ResizeHandle,
  startPoint: Point,
  point: Point,
  options: { minWidth?: number; minHeight?: number; keepRatio?: boolean } = {}
): Bounds => {
  const minWidth = options.minWidth ?? 24;
  const minHeight = options.minHeight ?? 24;
  const keepRatio = options.keepRatio ?? false;
  const left = initialBounds.x;
  const right = initialBounds.x + initialBounds.width;
  const top = initialBounds.y;
  const bottom = initialBounds.y + initialBounds.height;
  const deltaX = point.x - startPoint.x;
  const deltaY = point.y - startPoint.y;
  const safeInitialWidth = Math.max(initialBounds.width, 1);
  const safeInitialHeight = Math.max(initialBounds.height, 1);
  const aspectRatio = getAspectRatio(initialBounds);

  let nextLeft = left;
  let nextRight = right;
  let nextTop = top;
  let nextBottom = bottom;

  if (hasHorizontalResize(handle)) {
    if (isLeftHandle(handle)) {
      nextLeft = Math.min(left + deltaX, right - minWidth);
    } else {
      nextRight = Math.max(right + deltaX, left + minWidth);
    }
  }

  if (hasVerticalResize(handle)) {
    if (isTopHandle(handle)) {
      nextTop = Math.min(top + deltaY, bottom - minHeight);
    } else {
      nextBottom = Math.max(bottom + deltaY, top + minHeight);
    }
  }

  if (keepRatio && isCornerResizeHandle(handle)) {
    const proposedWidth = Math.max(minWidth, nextRight - nextLeft);
    const proposedHeight = Math.max(minHeight, nextBottom - nextTop);
    const widthScaleDelta = Math.abs(proposedWidth / safeInitialWidth - 1);
    const heightScaleDelta = Math.abs(proposedHeight / safeInitialHeight - 1);

    if (widthScaleDelta >= heightScaleDelta) {
      const targetWidth = proposedWidth;
      const targetHeight = Math.max(minHeight, targetWidth / Math.max(aspectRatio, 0.001));
      nextLeft = isLeftHandle(handle) ? right - targetWidth : left;
      nextRight = isLeftHandle(handle) ? right : left + targetWidth;
      nextTop = isTopHandle(handle) ? bottom - targetHeight : top;
      nextBottom = isTopHandle(handle) ? bottom : top + targetHeight;
    } else {
      const targetHeight = proposedHeight;
      const targetWidth = Math.max(minWidth, targetHeight * aspectRatio);
      nextLeft = isLeftHandle(handle) ? right - targetWidth : left;
      nextRight = isLeftHandle(handle) ? right : left + targetWidth;
      nextTop = isTopHandle(handle) ? bottom - targetHeight : top;
      nextBottom = isTopHandle(handle) ? bottom : top + targetHeight;
    }
  }

  const nextWidthRaw = nextRight - nextLeft;
  const nextHeightRaw = nextBottom - nextTop;
  const nextWidth = hasHorizontalResize(handle)
    ? Math.max(minWidth, nextWidthRaw)
    : initialBounds.width;
  const nextHeight = hasVerticalResize(handle)
    ? Math.max(minHeight, nextHeightRaw)
    : initialBounds.height;

  return {
    x: nextLeft,
    y: nextTop,
    width: nextWidth,
    height: nextHeight,
  };
};

export const resizeShapeFromSelection = (
  shape: ShapeData,
  initialBounds: Bounds,
  nextBounds: Bounds
): ShapeData => {
  if (shape.type !== 'markdown') {
    return scaleShapeInSelection(shape, initialBounds, nextBounds);
  }

  const safeInitialWidth = Math.max(initialBounds.width, 1);
  const safeInitialHeight = Math.max(initialBounds.height, 1);
  const scaleX = Math.max(24, nextBounds.width) / safeInitialWidth;
  const scaleY = Math.max(24, nextBounds.height) / safeInitialHeight;
  const baseWidth = Math.max(1, shape.data.width * (shape.data.scaleX ?? 1));
  const baseHeight = Math.max(1, shape.data.height * (shape.data.scaleY ?? 1));
  const nextX = nextBounds.x + (shape.data.x - initialBounds.x) * scaleX;
  const nextY = nextBounds.y + (shape.data.y - initialBounds.y) * scaleY;
  const nextWidth = Math.max(MIN_MARKDOWN_WIDTH, baseWidth * scaleX);
  const nextHeight = Math.max(MIN_MARKDOWN_HEIGHT, baseHeight * scaleY);

  return {
    type: 'markdown',
    data: {
      ...shape.data,
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight,
      scaleX: 1,
      scaleY: 1,
    },
  };
};

export const resizeSingleShapeFromTransformBounds = (
  shape: ShapeData,
  initialBounds: Bounds,
  nextBounds: Bounds
): ShapeData => {
  if (shape.type === 'markdown') {
    return {
      type: 'markdown',
      data: {
        ...shape.data,
        x: nextBounds.x,
        y: nextBounds.y,
        width: Math.max(MIN_MARKDOWN_WIDTH, nextBounds.width),
        height: Math.max(MIN_MARKDOWN_HEIGHT, nextBounds.height),
        scaleX: 1,
        scaleY: 1,
      },
    };
  }

  switch (shape.type) {
    case 'line': {
      return resizeLineFromTransformBounds(shape, initialBounds, nextBounds);
    }
    case 'rect':
    case 'image':
      return resizeRectLikeShapeFromTransformBounds(shape, initialBounds, nextBounds);
    default:
      return shape;
  }
};

export const hasVisibleHandles = (selectedShapes: ShapeWithId[]) =>
  getEnabledResizeHandles(selectedShapes).length > 0;

export const getDefaultResizeCursor = (handle: ResizeHandle) => {
  switch (handle) {
    case 'top-left':
    case 'bottom-right':
      return 'nwse-resize';
    case 'top-right':
    case 'bottom-left':
      return 'nesw-resize';
    case 'top-center':
    case 'bottom-center':
      return 'ns-resize';
    case 'middle-left':
    case 'middle-right':
      return 'ew-resize';
    default:
      return 'default';
  }
};

export const getAllResizeHandles = () => ALL_HANDLES;
