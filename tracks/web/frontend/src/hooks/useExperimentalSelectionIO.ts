import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { ShapeData } from '../types';
import { useWhiteboardStore } from '../store/useWhiteboardStore';
import {
  type SelectionClipboardPayload,
} from '../features/canvas-overlay/utils/selectionClipboard';
import { renderMarkdownShapeData } from '../utils/markdownShapePersistence';
import { useSelectionClipboardHotkeys } from './useSelectionClipboardHotkeys';
import { useSelectionMenuActions } from './useSelectionMenuActions';
import { useSelectionDomainState } from './useSelectionDomainState';
import { recognizeLatexFromSelection } from '../features/canvas-overlay/utils/latexOcr';
import { useSelectionAutoReorderSync } from './useSelectionAutoReorderSync';
import { writeClipboardData } from '../utils/clipboard';
import {
  SELECTION_CLIPBOARD_MIME,
  serializeSelectionClipboardPayload,
} from '../features/canvas-overlay/utils/selectionClipboard';

interface ActiveBoardLike {
  selectedShapes?: Array<{ id: string; shape: ShapeData }>;
  replaceSelection?: (ids: string[]) => void;
  editingMarkdown: {
    id: string;
    content: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

interface UseExperimentalSelectionIOOptions {
  isExperimental: boolean;
  currentCanvasId: string | null;
  currentLayerId: string | null;
  activeBoard: ActiveBoardLike;
  send: (msg: any) => void;
  onTokenStateChange: (state: 'unsaved') => void;
  selectionClipboardRef: MutableRefObject<SelectionClipboardPayload | null>;
  selectionPasteCountRef: MutableRefObject<number>;
  selectionPlainTextRef: MutableRefObject<string | null>;
  pasteFromClipboard: () => Promise<void>;
}

export const useExperimentalSelectionIO = ({
  isExperimental,
  currentCanvasId,
  currentLayerId,
  activeBoard,
  send,
  onTokenStateChange,
  selectionClipboardRef,
  selectionPasteCountRef,
  selectionPlainTextRef,
  pasteFromClipboard,
}: UseExperimentalSelectionIOOptions) => {
  const selectionDomain = useSelectionDomainState(activeBoard.selectedShapes);

  const copySelection = useCallback(async () => {
    if (!selectionDomain.hasSelection) return;
    const payload = selectionDomain.payload;
    if (!payload) return;

    selectionClipboardRef.current = payload;
    selectionPasteCountRef.current = 0;

    if (selectionDomain.markdownOnly) {
      const plainText = selectionDomain.plainText;
      selectionPlainTextRef.current = plainText ?? null;
      await writeClipboardData({
        text: plainText ?? '',
        whiteboardSelectionText: serializeSelectionClipboardPayload(payload),
        whiteboardSelectionMime: SELECTION_CLIPBOARD_MIME,
      });
      return;
    }

    selectionPlainTextRef.current = null;
    await writeClipboardData({
      text: serializeSelectionClipboardPayload(payload),
    });
  }, [
    selectionClipboardRef,
    selectionDomain.hasSelection,
    selectionDomain.markdownOnly,
    selectionDomain.payload,
    selectionDomain.plainText,
    selectionPasteCountRef,
    selectionPlainTextRef,
  ]);

  const deleteSelection = useCallback(() => {
    if (!currentCanvasId || !currentLayerId) return;
    if (!selectionDomain.hasSelection) return;

    const action = {
      type: 'erase' as const,
      payload: {
        shapeIds: selectionDomain.selectedIds,
        forceAllTypes: true,
      },
    };

    useWhiteboardStore.getState().applyErase(currentCanvasId, currentLayerId, action);
    send({
      event: 'layerOp',
      data: { canvasId: currentCanvasId, layerId: currentLayerId, action },
    });
    activeBoard.replaceSelection?.([]);
    onTokenStateChange('unsaved');
  }, [
    activeBoard.replaceSelection,
    currentCanvasId,
    currentLayerId,
    onTokenStateChange,
    selectionDomain.hasSelection,
    selectionDomain.selectedIds,
    send,
  ]);

  const createLatexTextBoxFromSelection = useCallback(async () => {
    if (!currentCanvasId || !currentLayerId) return;
    if (!selectionDomain.hasSelection) return;

    let markdownContent = selectionDomain.latexMarkdownContent;
    const recognizedLatex = await recognizeLatexFromSelection(selectionDomain.selectedShapes);
    if (recognizedLatex) {
      markdownContent = `$$\n${recognizedLatex}\n$$`;
    }

    if (!markdownContent) return;

    const bounds = selectionDomain.bounds;
    const targetX = bounds ? bounds.x + bounds.width + 24 : 80;
    const targetY = bounds ? bounds.y : 80;
    const width = bounds ? Math.min(Math.max(bounds.width, 280), 680) : 360;

    const markdownData = await renderMarkdownShapeData(markdownContent, {
      x: targetX,
      y: targetY,
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
    activeBoard.replaceSelection?.([shapeId]);
    onTokenStateChange('unsaved');
  }, [
    activeBoard.replaceSelection,
    currentCanvasId,
    currentLayerId,
    onTokenStateChange,
    selectionDomain.bounds,
    selectionDomain.hasSelection,
    selectionDomain.latexMarkdownContent,
    selectionDomain.selectedShapes,
    send,
  ]);

  useSelectionAutoReorderSync({
    isExperimental,
    currentCanvasId,
    currentLayerId,
    hasSelection: selectionDomain.hasSelection,
    selectedIds: selectionDomain.selectedIds,
    send,
    onTokenStateChange,
  });

  useSelectionClipboardHotkeys({
    isExperimental,
    editingMarkdownOpen: Boolean(activeBoard.editingMarkdown),
    selectionDomain,
    deleteSelection,
    copySelection,
  });

  useSelectionMenuActions({
    isExperimental,
    editingMarkdownOpen: Boolean(activeBoard.editingMarkdown),
    selectionDomain,
    deleteSelection,
    copySelection,
    pasteFromClipboard,
    createLatexTextBoxFromSelection,
  });
};
