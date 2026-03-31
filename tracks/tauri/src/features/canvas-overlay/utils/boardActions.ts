import type { Action, ShapeData } from '../../../types';
import {
  getMarkdownLayoutHeight,
  getMarkdownLayoutWidth,
  MIN_MARKDOWN_HEIGHT,
  MIN_MARKDOWN_WIDTH,
  normalizeMarkdownShapeData,
  rerenderMarkdownShape,
  renderMarkdownShapeData,
} from '../../../utils/markdownShapePersistence';
import type { ShapeWithId } from './shapeGeometry';
import { isShapeApproximatelyEqual } from './shapeApproxEqual';
import { normalizeCommittedShapeTransform } from './shapeTransformCommitNormalization';

export interface CommitContext {
  currentCanvasId: string | null;
  currentLayerId: string | null;
  send: (msg: any) => void;
  onTokenStateChange?: (state: 'unsaved') => void;
}

interface StoreActions {
  applyDraw: (canvasId: string, layerId: string, action: Action) => void;
  applyErase: (canvasId: string, layerId: string, action: Action) => void;
  applyUndo: (canvasId: string, layerId: string) => void;
  applyRedo: (canvasId: string, layerId: string) => void;
  applyUpdate: (canvasId: string, layerId: string, action: Action) => void;
  applyBatchUpdate: (canvasId: string, layerId: string, action: Action) => void;
}

export type ShapeCommitStoreActions = Pick<StoreActions, 'applyUpdate' | 'applyBatchUpdate'>;

const sendLayerAction = (
  { currentCanvasId, currentLayerId, send, onTokenStateChange }: CommitContext,
  action: Action
) => {
  if (!currentCanvasId || !currentLayerId) return false;

  send({
    event: 'layerOp',
    data: { canvasId: currentCanvasId, layerId: currentLayerId, action },
  });
  onTokenStateChange?.('unsaved');
  return true;
};

export const commitMarkdownSave = async (
  context: CommitContext,
  storeActions: Pick<StoreActions, 'applyDraw' | 'applyUpdate'>,
  editingMarkdown: {
    id: string;
    content: string;
    x: number;
    y: number;
    width: number;
    height?: number;
  },
  currentLayerShapes: ShapeWithId[],
  createId: () => string
) => {
  if (!context.currentCanvasId || !context.currentLayerId) return;

  const shapeWithId = editingMarkdown.id
    ? currentLayerShapes.find((shape) => shape.id === editingMarkdown.id)
    : null;

  if (editingMarkdown.id && !shapeWithId) return;

  const existingMarkdownData =
    shapeWithId && shapeWithId.shape.type === 'markdown' ? shapeWithId.shape.data : null;
  const fallbackHeight = Math.max(MIN_MARKDOWN_HEIGHT, 100);

  const markdownData = await renderMarkdownShapeData(editingMarkdown.content, {
    x: editingMarkdown.x,
    y: editingMarkdown.y,
    width: Math.max(editingMarkdown.width || 400, MIN_MARKDOWN_WIDTH),
    height:
      editingMarkdown.height ??
      (existingMarkdownData ? getMarkdownLayoutHeight(existingMarkdownData) : fallbackHeight),
  });

  if (!editingMarkdown.id) {
    const action: Action = {
      type: 'draw',
      payload: {
        id: createId(),
        shape: { type: 'markdown', data: markdownData },
      },
    };

    storeActions.applyDraw(context.currentCanvasId, context.currentLayerId, action);
    sendLayerAction(context, action);
    return;
  }

  if (!shapeWithId) return;

  const oldMarkdown =
    shapeWithId.shape.type === 'markdown'
      ? shapeWithId.shape.data
      : { x: editingMarkdown.x, y: editingMarkdown.y };

  const action: Action = {
    type: 'update',
    payload: {
      id: editingMarkdown.id,
      oldShape: shapeWithId.shape,
      newShape: {
        type: 'markdown',
        data: normalizeMarkdownShapeData(markdownData, {
          x: oldMarkdown.x,
          y: oldMarkdown.y,
        }),
      },
    },
  };

  storeActions.applyUpdate(context.currentCanvasId, context.currentLayerId, action);
  sendLayerAction(context, action);
};

const finalizeUpdatedShape = async (
  oldShape: ShapeData,
  newShape: ShapeData
): Promise<ShapeData> => {
  const normalizedShape = normalizeCommittedShapeTransform(newShape);
  if (oldShape.type !== 'markdown' || normalizedShape.type !== 'markdown') {
    return normalizedShape;
  }

  const oldWidth = getMarkdownLayoutWidth(oldShape.data);
  const newWidth = getMarkdownLayoutWidth(normalizedShape.data);
  const oldHeight = getMarkdownLayoutHeight(oldShape.data);
  const newHeight = getMarkdownLayoutHeight(normalizedShape.data);

  if (Math.abs(oldWidth - newWidth) > 0.5 || Math.abs(oldHeight - newHeight) > 0.5) {
    const markdownData = await rerenderMarkdownShape(normalizedShape, {
      x: normalizedShape.data.x,
      y: normalizedShape.data.y,
      width: Math.max(newWidth, MIN_MARKDOWN_WIDTH),
      height: Math.max(newHeight, MIN_MARKDOWN_HEIGHT),
    });

    return {
      type: 'markdown',
      data: markdownData,
    };
  }

  return {
    type: 'markdown',
    data: normalizeMarkdownShapeData(normalizedShape.data, {
      x: normalizedShape.data.x,
      y: normalizedShape.data.y,
      width: Math.max(newWidth, MIN_MARKDOWN_WIDTH),
      height: Math.max(newHeight, MIN_MARKDOWN_HEIGHT),
      scaleX: 1,
      scaleY: 1,
    }),
  };
};

export const commitShapeUpdates = async (
  context: CommitContext,
  storeActions: Pick<StoreActions, 'applyUpdate' | 'applyBatchUpdate'>,
  updates: ShapeWithId[],
  initialShapes: ShapeWithId[]
) => {
  if (!context.currentCanvasId || !context.currentLayerId || updates.length === 0) return;

  const normalizedUpdates = (
    await Promise.all(
      updates.map(async (updatedShape) => {
        const originalShape = initialShapes.find((shape) => shape.id === updatedShape.id);
        if (!originalShape) return null;

        if (isShapeApproximatelyEqual(originalShape.shape, updatedShape.shape)) {
          return null;
        }

        const finalizedShape = await finalizeUpdatedShape(
          originalShape.shape,
          updatedShape.shape
        );

        if (isShapeApproximatelyEqual(originalShape.shape, finalizedShape)) {
          return null;
        }

        return {
          id: updatedShape.id,
          oldShape: originalShape.shape,
          newShape: finalizedShape,
        };
      })
    )
  )
    .filter((item): item is { id: string; oldShape: ShapeData; newShape: ShapeData } => item !== null);

  if (normalizedUpdates.length === 0) return;

  const action: Action =
    normalizedUpdates.length === 1
      ? { type: 'update', payload: normalizedUpdates[0] }
      : { type: 'batchUpdate', payload: { updates: normalizedUpdates } };

  if (action.type === 'update') {
    storeActions.applyUpdate(context.currentCanvasId, context.currentLayerId, action);
  } else {
    storeActions.applyBatchUpdate(context.currentCanvasId, context.currentLayerId, action);
  }

  sendLayerAction(context, action);
};

export const commitUndo = (
  context: CommitContext,
  storeActions: Pick<StoreActions, 'applyUndo'>
) => {
  if (!context.currentCanvasId || !context.currentLayerId) return;

  storeActions.applyUndo(context.currentCanvasId, context.currentLayerId);
  sendLayerAction(context, { type: 'undo', payload: null });
};

export const commitRedo = (
  context: CommitContext,
  storeActions: Pick<StoreActions, 'applyRedo'>
) => {
  if (!context.currentCanvasId || !context.currentLayerId) return;

  storeActions.applyRedo(context.currentCanvasId, context.currentLayerId);
  sendLayerAction(context, { type: 'redo', payload: null });
};

export const commitClear = (
  context: CommitContext,
  storeActions: Pick<StoreActions, 'applyErase'>,
  currentLayerShapes: ShapeWithId[]
) => {
  if (!context.currentCanvasId || !context.currentLayerId) return;

  const shapeIds = currentLayerShapes.map((shape) => shape.id);
  if (shapeIds.length === 0) return;

  const action: Action = {
    type: 'erase',
    payload: { shapeIds },
  };

  storeActions.applyErase(context.currentCanvasId, context.currentLayerId, action);
  sendLayerAction(context, action);
};
