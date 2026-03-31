import {
  MIN_MARKDOWN_HEIGHT,
  MIN_MARKDOWN_WIDTH,
} from '../../../utils/markdownShapePersistence';
import type { ShapeData } from '../../../types';
import { getScaledSelectionPreview } from './selectionFramePreview';
import { expandSelectionBounds } from './selectionOverlayState';
import {
  isCornerResizeHandle,
  resizeShapeFromSelection,
  resizeSingleShapeFromTransformBounds,
  type ResizeHandle,
} from './selectionResize';
import type { Bounds, Point, ShapeWithId } from './shapeGeometry';
import { getSingleShapeTransformBounds } from './selectionTransformBounds';

interface ScaleSelectionPreviewInput {
  displayBounds: Bounds;
  selectionBounds: Bounds;
  handle: ResizeHandle;
  startPointer: Point;
  pointer: Point;
  initialShapes: ShapeWithId[];
  visualPadding: number;
}

const getMinSelectionSizeForMarkdownBatch = (
  initialShapes: ShapeWithId[],
  selectionBounds: Bounds
) => {
  const markdownShapes = initialShapes.filter(
    (shape): shape is ShapeWithId & { shape: Extract<ShapeData, { type: 'markdown' }> } =>
      shape.shape.type === 'markdown'
  );

  if (markdownShapes.length === 0) {
    return {
      minSelectionWidth: 24,
      minSelectionHeight: 24,
    };
  }

  const safeSelectionWidth = Math.max(selectionBounds.width, 1);
  const safeSelectionHeight = Math.max(selectionBounds.height, 1);

  let minScaleX = 0;
  let minScaleY = 0;

  markdownShapes.forEach((shape) => {
    const baseWidth = Math.max(1, shape.shape.data.width * (shape.shape.data.scaleX ?? 1));
    const baseHeight = Math.max(1, shape.shape.data.height * (shape.shape.data.scaleY ?? 1));
    minScaleX = Math.max(minScaleX, MIN_MARKDOWN_WIDTH / baseWidth);
    minScaleY = Math.max(minScaleY, MIN_MARKDOWN_HEIGHT / baseHeight);
  });

  return {
    minSelectionWidth: Math.max(24, safeSelectionWidth * minScaleX),
    minSelectionHeight: Math.max(24, safeSelectionHeight * minScaleY),
  };
};

export const getScaleSelectionPreviewState = ({
  displayBounds,
  selectionBounds,
  handle,
  startPointer,
  pointer,
  initialShapes,
  visualPadding,
}: ScaleSelectionPreviewInput) => {
  const singleShape = initialShapes.length === 1 ? initialShapes[0] : null;
  const isMarkdownOnly = singleShape?.shape.type === 'markdown';
  const markdownBatchMinSize =
    !singleShape && initialShapes.length > 1
      ? getMinSelectionSizeForMarkdownBatch(initialShapes, selectionBounds)
      : null;
  const isSingleRotatedShape =
    Boolean(singleShape) &&
    singleShape?.shape.type !== 'markdown' &&
    Math.abs(singleShape?.shape.data.rotation ?? 0) > 0.001;
  const { displayBounds: nextDisplayBounds, selectionBounds: nextSelectionBounds } =
    getScaledSelectionPreview({
      displayBounds,
      handle,
      startPointer,
      pointer,
      visualPadding,
      minWidth: isMarkdownOnly
        ? MIN_MARKDOWN_WIDTH + visualPadding * 2
        : markdownBatchMinSize
          ? markdownBatchMinSize.minSelectionWidth + visualPadding * 2
          : 24,
      minHeight: isMarkdownOnly
        ? MIN_MARKDOWN_HEIGHT + visualPadding * 2
        : markdownBatchMinSize
          ? markdownBatchMinSize.minSelectionHeight + visualPadding * 2
          : 24,
      keepRatio: !isMarkdownOnly && isCornerResizeHandle(handle),
    });

  const previewShapes = new Map<string, ShapeData>();
  if (singleShape && isSingleRotatedShape) {
    const previewShape = resizeSingleShapeFromTransformBounds(
      singleShape.shape,
      selectionBounds,
      nextSelectionBounds
    );
    previewShapes.set(singleShape.id, previewShape);

    const previewBounds = getSingleShapeTransformBounds(previewShape);
    return {
      previewShapes,
      nextDisplayBounds: expandSelectionBounds(
        previewBounds || nextSelectionBounds,
        visualPadding
      ),
    };
  }

  initialShapes.forEach((shape) => {
    previewShapes.set(
      shape.id,
      resizeShapeFromSelection(shape.shape, selectionBounds, nextSelectionBounds)
    );
  });

  return {
    previewShapes,
    nextDisplayBounds,
  };
};
