import { useWhiteboardStore } from '../store/useWhiteboardStore';
import type { ShapeData } from '../types';
import {
  buildPastedShapesFromClipboardPayload,
  type SelectionClipboardPayload,
} from '../features/canvas-overlay/utils/selectionClipboard';
import { renderMarkdownShapeData } from './markdownShapePersistence';

interface PasteSelectionOptions {
  payload: SelectionClipboardPayload;
  currentCanvasId: string | null;
  currentLayerId: string | null;
  targetAnchor: { x: number; y: number };
  pasteCount: number;
  send: (msg: any) => void;
  onTokenStateChange: (state: 'unsaved') => void;
  replaceSelection?: (ids: string[]) => void;
}

interface PastePlainTextOptions {
  text: string;
  currentCanvasId: string | null;
  currentLayerId: string | null;
  targetCenter: { x: number; y: number };
  send: (msg: any) => void;
  onTokenStateChange: (state: 'unsaved') => void;
  replaceSelection?: (ids: string[]) => void;
}

export const isEditableEventTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};

const hydratePastedShape = async (shape: ShapeData): Promise<ShapeData> => {
  if (shape.type !== 'markdown' || shape.data.renderedImage) {
    return shape;
  }

  const rerendered = await renderMarkdownShapeData(shape.data.content, {
    x: shape.data.x,
    y: shape.data.y,
    width: shape.data.width,
    height: shape.data.height,
  });

  return {
    type: 'markdown',
    data: {
      ...rerendered,
      rotation: shape.data.rotation ?? 0,
      scaleX: shape.data.scaleX ?? 1,
      scaleY: shape.data.scaleY ?? 1,
    },
  };
};

export const pasteSelectionToCanvas = async ({
  payload,
  currentCanvasId,
  currentLayerId,
  targetAnchor,
  pasteCount,
  send,
  onTokenStateChange,
  replaceSelection,
}: PasteSelectionOptions): Promise<SelectionClipboardPayload | null> => {
  if (!currentCanvasId || !currentLayerId) return null;

  const pastedShapes = buildPastedShapesFromClipboardPayload(payload, {
    targetAnchor,
    pasteCount,
  });
  if (pastedShapes.length === 0) return null;

  const hydratedShapes = await Promise.all(pastedShapes.map(hydratePastedShape));
  const { v4: uuidv4 } = await import('uuid');
  const applyDraw = useWhiteboardStore.getState().applyDraw;
  const pastedIds: string[] = [];

  hydratedShapes.forEach((shape) => {
    const pastedId = uuidv4();
    pastedIds.push(pastedId);
    const action = {
      type: 'draw' as const,
      payload: {
        id: pastedId,
        shape,
      },
    };

    applyDraw(currentCanvasId, currentLayerId, action);
    send({
      event: 'layerOp',
      data: { canvasId: currentCanvasId, layerId: currentLayerId, action },
    });
  });

  if (pastedIds.length > 0) {
    replaceSelection?.(pastedIds);
  }

  onTokenStateChange('unsaved');
  return payload;
};

export const pastePlainTextAsMarkdown = async ({
  text,
  currentCanvasId,
  currentLayerId,
  targetCenter,
  send,
  onTokenStateChange,
  replaceSelection,
}: PastePlainTextOptions) => {
  if (!currentCanvasId || !currentLayerId) return;

  const normalizedText = text.trim();
  if (normalizedText.length === 0) return;

  const width = 360;
  const markdownData = await renderMarkdownShapeData(normalizedText, {
    x: targetCenter.x - width / 2,
    y: targetCenter.y - 80,
    width,
  });

  const { v4: uuidv4 } = await import('uuid');
  const shapeId = uuidv4();
  const action = {
    type: 'draw' as const,
    payload: {
      id: shapeId,
      shape: {
        type: 'markdown' as const,
        data: markdownData,
      },
    },
  };

  useWhiteboardStore.getState().applyDraw(currentCanvasId, currentLayerId, action);
  send({
    event: 'layerOp',
    data: { canvasId: currentCanvasId, layerId: currentLayerId, action },
  });
  replaceSelection?.([shapeId]);
  onTokenStateChange('unsaved');
};
