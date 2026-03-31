import type React from 'react';
import type { Action } from '../../../types';
import { simplifyLinePointsForCommit } from './lineCommitSimplify';
import { getShapesInBounds, type Bounds, type Point, type ShapeWithId } from './shapeGeometry';
import { applySelectionIds } from './selectionState';
import { getShapesInLasso } from './selectionLasso';
import { finalizeSelectionTransformPointerUp } from './selectionTransformPointerUp';
import { isSelectionTransformState } from './selectionTransformSession';
import type { InteractionState } from './boardInteractionTypes';

interface CommitContextLike {
  currentCanvasId: string | null;
  currentLayerId: string | null;
  send: (msg: any) => void;
  onTokenStateChange?: (state: 'unsaved') => void;
}

interface HandleTransformPointerUpOptions {
  interaction: InteractionState;
  interactionRef: React.MutableRefObject<InteractionState>;
  previewShapesRef: React.MutableRefObject<Map<string, any>>;
  commitContext: CommitContextLike;
  applyUpdate: (...args: any[]) => void;
  applyBatchUpdate: (...args: any[]) => void;
  resetSelectionTransient: (options?: { clearMarquee?: boolean }) => void;
}

export const commitDrawPointerUp = ({
  interaction,
  currentCanvasId,
  currentLayerId,
  currentPoints,
  penConfig,
  applyDraw,
  send,
  onTokenStateChange,
}: {
  interaction: Extract<InteractionState, { kind: 'draw' }>;
  currentCanvasId: string | null;
  currentLayerId: string | null;
  currentPoints: number[];
  penConfig: { color: string; size: number };
  applyDraw: (canvasId: string, layerId: string, action: Action) => void;
  send: (msg: any) => void;
  onTokenStateChange?: (state: 'unsaved') => void;
}) => {
  if (!currentCanvasId || !currentLayerId || currentPoints.length < 2) return;

  const committedPoints = simplifyLinePointsForCommit(currentPoints, {
    penSize: penConfig.size,
  });
  const action: Action = {
    type: 'draw',
    payload: {
      id: interaction.shapeId,
      shape: {
        type: 'line',
        data: {
          points: committedPoints,
          stroke: penConfig.color,
          stroke_width: penConfig.size,
        },
      },
    },
  };

  applyDraw(currentCanvasId, currentLayerId, action);
  send({
    event: 'layerOp',
    data: { canvasId: currentCanvasId, layerId: currentLayerId, action },
  });
  onTokenStateChange?.('unsaved');
};

export const commitErasePointerUp = ({
  interaction,
  currentCanvasId,
  currentLayerId,
  applyErase,
  send,
  onTokenStateChange,
}: {
  interaction: Extract<InteractionState, { kind: 'erase' }>;
  currentCanvasId: string | null;
  currentLayerId: string | null;
  applyErase: (canvasId: string, layerId: string, action: Action) => void;
  send: (msg: any) => void;
  onTokenStateChange?: (state: 'unsaved') => void;
}) => {
  if (!currentCanvasId || !currentLayerId || interaction.erasedIds.size === 0) return;

  const action: Action = {
    type: 'erase',
    payload: { shapeIds: Array.from(interaction.erasedIds) },
  };

  applyErase(currentCanvasId, currentLayerId, action);
  send({
    event: 'layerOp',
    data: { canvasId: currentCanvasId, layerId: currentLayerId, action },
  });
  onTokenStateChange?.('unsaved');
};

export const resolveMarqueeSelectionPointerUp = ({
  interaction,
  selectionRect,
  currentLayerDisplayShapes,
  selectedIds,
  replaceSelection,
  setSelectionRect,
}: {
  interaction: Extract<InteractionState, { kind: 'marquee' }>;
  selectionRect: Bounds | null;
  currentLayerDisplayShapes: ShapeWithId[];
  selectedIds: string[];
  replaceSelection: (ids: string[]) => void;
  setSelectionRect: React.Dispatch<React.SetStateAction<Bounds | null>>;
}) => {
  const candidateIds = selectionRect
    ? getShapesInBounds(currentLayerDisplayShapes, selectionRect).map((shape) => shape.id)
    : [];
  replaceSelection(applySelectionIds(selectedIds, candidateIds, interaction.selectionMode));
  setSelectionRect(null);
};

export const resolveLassoSelectionPointerUp = ({
  interaction,
  selectionLassoPoints,
  currentLayerDisplayShapes,
  selectedIds,
  replaceSelection,
}: {
  interaction: Extract<InteractionState, { kind: 'lasso' }>;
  selectionLassoPoints: Point[] | null;
  currentLayerDisplayShapes: ShapeWithId[];
  selectedIds: string[];
  replaceSelection: (ids: string[]) => void;
}) => {
  if (selectionLassoPoints && selectionLassoPoints.length >= 3) {
    const shapes = getShapesInLasso(currentLayerDisplayShapes, selectionLassoPoints);
    replaceSelection(
      applySelectionIds(
        selectedIds,
        shapes.map((shape) => shape.id),
        interaction.selectionMode
      )
    );
    return;
  }

  replaceSelection(applySelectionIds(selectedIds, [], interaction.selectionMode));
};

export const resolvePendingSelectPointerUp = ({
  interaction,
  selectedIds,
  replaceSelection,
}: {
  interaction: Extract<InteractionState, { kind: 'pending-select' }>;
  selectedIds: string[];
  replaceSelection: (ids: string[]) => void;
}) => {
  replaceSelection(
    applySelectionIds(selectedIds, [interaction.shapeId], interaction.selectionMode)
  );
};

export const handleTransformPointerUp = async ({
  interaction,
  interactionRef,
  previewShapesRef,
  commitContext,
  applyUpdate,
  applyBatchUpdate,
  resetSelectionTransient,
}: HandleTransformPointerUpOptions) => {
  if (!isSelectionTransformState(interaction)) return;

  await finalizeSelectionTransformPointerUp({
    interaction,
    interactionRef,
    previewShapesRef,
    context: commitContext,
    storeActions: { applyUpdate, applyBatchUpdate },
    resetSelectionTransient,
  });
};
