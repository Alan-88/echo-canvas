import type { ShapeData } from '../../../types';
import type { Bounds, Point, ShapeWithId } from './shapeGeometry';
import { translateShape } from './shapeGeometry';
import type { ResizeHandle } from './selectionResize';
import { translateBounds } from './selectionFramePreview';
import { getScaleSelectionPreviewState } from './selectionScalePreview';
import { getSelectionLocalPointerFromWorldDelta } from './selectionPointerMath';
import {
  getRotationAngleDelta,
  rotateShapeAroundSelectionCenter,
  snapRotationRadians,
} from './selectionRotate';

export type SelectionTransformState =
  | {
      kind: 'drag-selection';
      startPoint: Point;
      initialDisplayBounds: Bounds;
      initialShapes: ShapeWithId[];
    }
  | {
      kind: 'scale-selection';
      handle: ResizeHandle;
      startPoint: Point;
      startWorldPoint: Point;
      rotationDegrees: number;
      selectionBounds: Bounds;
      displayBounds: Bounds;
      initialShapes: ShapeWithId[];
    }
  | {
      kind: 'rotate-selection';
      selectionBounds: Bounds;
      displayBounds: Bounds;
      startPoint: Point;
      initialShapes: ShapeWithId[];
    };

export const isSelectionTransformState = (
  interaction: { kind: string }
): interaction is SelectionTransformState =>
  interaction.kind === 'drag-selection' ||
  interaction.kind === 'scale-selection' ||
  interaction.kind === 'rotate-selection';

export const getDragSelectionPreviewState = (
  interaction: Extract<SelectionTransformState, { kind: 'drag-selection' }>,
  point: Point
): { previewShapes: Map<string, ShapeData>; nextDisplayBounds: Bounds } => {
  const deltaX = point.x - interaction.startPoint.x;
  const deltaY = point.y - interaction.startPoint.y;
  const previewShapes = new Map<string, ShapeData>();

  interaction.initialShapes.forEach((shape) => {
    previewShapes.set(shape.id, translateShape(shape.shape, deltaX, deltaY));
  });

  return {
    previewShapes,
    nextDisplayBounds: translateBounds(interaction.initialDisplayBounds, deltaX, deltaY),
  };
};

export const getScaleSelectionTransformPreviewState = ({
  interaction,
  point,
  visualPadding,
}: {
  interaction: Extract<SelectionTransformState, { kind: 'scale-selection' }>;
  point: Point;
  visualPadding: number;
}): { previewShapes: Map<string, ShapeData>; nextDisplayBounds: Bounds } => {
  const overlayPoint = getSelectionLocalPointerFromWorldDelta({
    startLocalPoint: interaction.startPoint,
    startWorldPoint: interaction.startWorldPoint,
    currentWorldPoint: point,
    rotationDegrees: interaction.rotationDegrees,
  });

  return getScaleSelectionPreviewState({
    displayBounds: interaction.displayBounds,
    selectionBounds: interaction.selectionBounds,
    handle: interaction.handle,
    startPointer: interaction.startPoint,
    pointer: overlayPoint,
    initialShapes: interaction.initialShapes,
    visualPadding,
  });
};

export const getRotateSelectionPreviewState = ({
  interaction,
  point,
  snap,
}: {
  interaction: Extract<SelectionTransformState, { kind: 'rotate-selection' }>;
  point: Point;
  snap: boolean;
}): { previewShapes: Map<string, ShapeData>; rotationDegrees: number } => {
  const rawDelta = getRotationAngleDelta(
    {
      x: interaction.selectionBounds.x + interaction.selectionBounds.width / 2,
      y: interaction.selectionBounds.y + interaction.selectionBounds.height / 2,
    },
    interaction.startPoint,
    point
  );
  const deltaRadians = snap ? snapRotationRadians(rawDelta) : rawDelta;
  const previewShapes = new Map<string, ShapeData>();

  interaction.initialShapes.forEach((shape) => {
    previewShapes.set(
      shape.id,
      rotateShapeAroundSelectionCenter(shape.shape, interaction.selectionBounds, deltaRadians)
    );
  });

  return {
    previewShapes,
    rotationDegrees: (deltaRadians * 180) / Math.PI,
  };
};
