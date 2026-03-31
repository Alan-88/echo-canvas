import type React from 'react';
import type { ShapeData } from '../../../types';
import { normalizeBounds, type Bounds, type Point } from './shapeGeometry';
import { hasPointerMovedEnoughForMarquee } from './selectionPointerIntent';
import { appendLassoPoint } from './selectionLasso';
import {
  getDragSelectionPreviewState,
  getRotateSelectionPreviewState,
  getScaleSelectionTransformPreviewState,
} from './selectionTransformSession';
import type { InteractionState } from './boardInteractionTypes';

interface HandleSelectionPointerMoveOptions {
  interaction: InteractionState;
  point: Point;
  shiftKey: boolean;
  stageScale: number;
  selectionVisualPadding: number;
  resolveSelectionDragMode: (shiftKey: boolean) => 'marquee' | 'lasso';
  replaceSelection: (ids: string[]) => void;
  resetSelectionTransient: (options?: { clearMarquee?: boolean }) => void;
  interactionRef: React.MutableRefObject<InteractionState>;
  setSelectionRect: React.Dispatch<React.SetStateAction<Bounds | null>>;
  setSelectionLassoPoints: React.Dispatch<React.SetStateAction<Point[] | null>>;
  setPreviewShapesState: (nextPreviewShapes: Map<string, ShapeData>) => void;
  setSelectionDisplayBoundsPreview: React.Dispatch<React.SetStateAction<Bounds | null>>;
  setSelectionRotationPreview: React.Dispatch<React.SetStateAction<number | null>>;
}

export const handleSelectionPointerMove = ({
  interaction,
  point,
  shiftKey,
  stageScale,
  selectionVisualPadding,
  resolveSelectionDragMode,
  replaceSelection,
  resetSelectionTransient,
  interactionRef,
  setSelectionRect,
  setSelectionLassoPoints,
  setPreviewShapesState,
  setSelectionDisplayBoundsPreview,
  setSelectionRotationPreview,
}: HandleSelectionPointerMoveOptions): boolean => {
  if (interaction.kind === 'marquee') {
    setSelectionRect(
      normalizeBounds({
        x: interaction.startPoint.x,
        y: interaction.startPoint.y,
        width: point.x - interaction.startPoint.x,
        height: point.y - interaction.startPoint.y,
      })
    );
    return true;
  }

  if (interaction.kind === 'lasso') {
    const minDistance = 3 / Math.max(stageScale, 0.25);
    const nextPoints = appendLassoPoint(interaction.points, point, minDistance);
    if (nextPoints !== interaction.points) {
      interaction.points = nextPoints;
      setSelectionLassoPoints(nextPoints);
    }
    return true;
  }

  if (interaction.kind === 'pending-select') {
    if (
      hasPointerMovedEnoughForMarquee({
        startPoint: interaction.startPoint,
        currentPoint: point,
        stageScale,
      })
    ) {
      if (interaction.selectionMode === 'replace') {
        replaceSelection([]);
      } else {
        resetSelectionTransient({ clearMarquee: false });
        setSelectionLassoPoints(null);
      }
      if (resolveSelectionDragMode(shiftKey) === 'lasso') {
        const points = [interaction.startPoint, point];
        setSelectionLassoPoints(points);
        interactionRef.current = {
          kind: 'lasso',
          points,
          selectionMode: interaction.selectionMode,
        };
      } else {
        setSelectionRect(
          normalizeBounds({
            x: interaction.startPoint.x,
            y: interaction.startPoint.y,
            width: point.x - interaction.startPoint.x,
            height: point.y - interaction.startPoint.y,
          })
        );
        interactionRef.current = {
          kind: 'marquee',
          startPoint: interaction.startPoint,
          selectionMode: interaction.selectionMode,
        };
      }
    }
    return true;
  }

  if (interaction.kind === 'drag-selection') {
    const { previewShapes: nextPreview, nextDisplayBounds } =
      getDragSelectionPreviewState(interaction, point);
    setPreviewShapesState(nextPreview);
    setSelectionDisplayBoundsPreview(nextDisplayBounds);
    return true;
  }

  if (interaction.kind === 'scale-selection') {
    const { previewShapes: nextPreview, nextDisplayBounds } =
      getScaleSelectionTransformPreviewState({
        interaction,
        point,
        visualPadding: selectionVisualPadding,
      });
    setPreviewShapesState(nextPreview);
    setSelectionDisplayBoundsPreview(nextDisplayBounds);
    return true;
  }

  if (interaction.kind === 'rotate-selection') {
    const { previewShapes: nextPreview, rotationDegrees } = getRotateSelectionPreviewState({
      interaction,
      point,
      snap: shiftKey,
    });
    setSelectionRotationPreview(rotationDegrees);
    setPreviewShapesState(nextPreview);
    return true;
  }

  return false;
};
