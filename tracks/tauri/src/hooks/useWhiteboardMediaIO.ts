import { useEffect, useRef } from 'react';
import { useWhiteboardStore } from '../store/useWhiteboardStore';
import {
  parseSelectionClipboardPayload,
  SELECTION_CLIPBOARD_MIME,
  type SelectionClipboardPayload,
} from '../features/canvas-overlay/utils/selectionClipboard';
import { useExperimentalSelectionIO } from './useExperimentalSelectionIO';
import {
  isEditableEventTarget,
  pastePlainTextAsMarkdown,
  pasteSelectionToCanvas,
} from '../utils/whiteboardClipboardActions';
import type { ShapeData } from '../types';
import { readClipboardData } from '../utils/clipboard';

interface ActiveBoardLike {
  stageScale: number;
  stagePos: { x: number; y: number };
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
  setEditingMarkdown: (data: any) => void;
}

interface UseWhiteboardMediaIOOptions {
  currentCanvasId: string | null;
  currentLayerId: string | null;
  activeBoard: ActiveBoardLike;
  getExperimentalCanvasPoint: (clientX: number, clientY: number) => { x: number; y: number } | null;
  send: (msg: any) => void;
  onTokenStateChange: (state: 'unsaved') => void;
}

export const useWhiteboardMediaIO = ({
  currentCanvasId,
  currentLayerId,
  activeBoard,
  getExperimentalCanvasPoint,
  send,
  onTokenStateChange,
}: UseWhiteboardMediaIOOptions) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const selectionClipboardRef = useRef<SelectionClipboardPayload | null>(null);
  const selectionPasteCountRef = useRef(0);
  const selectionPlainTextRef = useRef<string | null>(null);

  const getViewportCenterInScene = () => ({
    x:
      window.innerWidth / 2 / activeBoard.stageScale -
      activeBoard.stagePos.x / activeBoard.stageScale,
    y:
      window.innerHeight / 2 / activeBoard.stageScale -
      activeBoard.stagePos.y / activeBoard.stageScale,
  });

  const addImageToCanvas = async (file: File, dropPosition?: { x: number; y: number }) => {
    if (!currentCanvasId || !currentLayerId) return;

    try {
      const { compressImage } = await import('../utils/imageCompressor');
      const compressedDataURL = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.8,
      });

      const image = new Image();
      image.src = compressedDataURL;
      await new Promise((resolve) => {
        image.onload = resolve;
      });

      const position = dropPosition || getViewportCenterInScene();

      const { v4: uuidv4 } = await import('uuid');
      const newShapeId = uuidv4();
      const action = {
        type: 'draw' as const,
        payload: {
          id: newShapeId,
          shape: {
            type: 'image' as const,
            data: {
              x: position.x - image.width / 2,
              y: position.y - image.height / 2,
              width: image.width,
              height: image.height,
              src: compressedDataURL,
            },
          },
        },
      };

      useWhiteboardStore.getState().applyDraw(currentCanvasId, currentLayerId, action);
      send({
        event: 'layerOp',
        data: { canvasId: currentCanvasId, layerId: currentLayerId, action },
      });
      onTokenStateChange('unsaved');
    } catch (error) {
      console.error('[Image] 添加失败:', error);
    }
  };

  useExperimentalSelectionIO({
    isExperimental: true,
    currentCanvasId,
    currentLayerId,
    activeBoard,
    send,
    onTokenStateChange,
    selectionClipboardRef,
    selectionPasteCountRef,
    selectionPlainTextRef,
    pasteFromClipboard: async () => {
      const clipboardResult = await readClipboardData({
        whiteboardSelectionMime: SELECTION_CLIPBOARD_MIME,
      });
      const clipboardText = clipboardResult.text || '';
      const clipboardSelectionText = clipboardResult.whiteboardSelectionText;
      const textPayload = parseSelectionClipboardPayload(
        clipboardSelectionText || clipboardText
      );

      if (currentCanvasId && currentLayerId) {
        const payload = textPayload || selectionClipboardRef.current;
        if (payload) {
          const pastedPayload = await pasteSelectionToCanvas({
            payload,
            currentCanvasId,
            currentLayerId,
            targetAnchor: getViewportCenterInScene(),
            pasteCount: selectionPasteCountRef.current + 1,
            send,
            onTokenStateChange,
            replaceSelection: activeBoard.replaceSelection,
          });
          if (pastedPayload) {
            selectionClipboardRef.current = pastedPayload;
            selectionPasteCountRef.current += 1;
          }
          return;
        }

        if (clipboardText.trim().length > 0) {
          await pastePlainTextAsMarkdown({
            text: clipboardText,
            currentCanvasId,
            currentLayerId,
            targetCenter: getViewportCenterInScene(),
            send,
            onTokenStateChange,
            replaceSelection: activeBoard.replaceSelection,
          });
        }
      }
    },
  });

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      if (activeBoard.editingMarkdown || isEditableEventTarget(event.target)) return;

      const clipboardData = event.clipboardData;
      const clipboardText = clipboardData?.getData('text/plain');
      const clipboardSelectionText = clipboardData?.getData(SELECTION_CLIPBOARD_MIME);
      const textPayload = parseSelectionClipboardPayload(
        clipboardSelectionText || clipboardText
      );
      const canUseTextBoundMemoryPayload =
        Boolean(selectionClipboardRef.current) &&
        Boolean(selectionPlainTextRef.current) &&
        typeof clipboardText === 'string' &&
        clipboardText === selectionPlainTextRef.current;
      const canUseMemoryClipboard =
        !clipboardData ||
        canUseTextBoundMemoryPayload ||
        (((clipboardText || '').trim().length === 0) &&
          (!clipboardData.items || clipboardData.items.length === 0));

      if (currentCanvasId && currentLayerId) {
        const payload =
          textPayload || (canUseMemoryClipboard ? selectionClipboardRef.current : null);
        if (payload) {
          event.preventDefault();
          const pastedPayload = await pasteSelectionToCanvas({
            payload,
            currentCanvasId,
            currentLayerId,
            targetAnchor: getViewportCenterInScene(),
            pasteCount: selectionPasteCountRef.current + 1,
            send,
            onTokenStateChange,
            replaceSelection: activeBoard.replaceSelection,
          });
          if (pastedPayload) {
            selectionClipboardRef.current = pastedPayload;
            selectionPasteCountRef.current += 1;
          }
          return;
        }

        if ((clipboardText || '').trim().length > 0) {
          event.preventDefault();
          await pastePlainTextAsMarkdown({
            text: clipboardText || '',
            currentCanvasId,
            currentLayerId,
            targetCenter: getViewportCenterInScene(),
            send,
            onTokenStateChange,
            replaceSelection: activeBoard.replaceSelection,
          });
          return;
        }
      }

      const items = clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (!item.type.startsWith('image/')) continue;

        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await addImageToCanvas(file);
        }
        break;
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [
    activeBoard.editingMarkdown,
    activeBoard.stagePos,
    activeBoard.stageScale,
    currentCanvasId,
    currentLayerId,
    send,
    onTokenStateChange,
  ]);

  const handleInsertMarkdown = () => {
    const center = getViewportCenterInScene();

    activeBoard.setEditingMarkdown({
      id: '',
      content: '',
      x: center.x - 150,
      y: center.y - 50,
      width: 300,
      height: 100,
    });
  };

  const handleInsertImage = () => {
    imageInputRef.current?.click();
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const files = Array.from(event.dataTransfer.files);
    const jsonFile = files.find(
      (file) =>
        file.type === 'application/json' ||
        file.type === 'text/json' ||
        file.name.toLowerCase().endsWith('.json')
    );

    if (jsonFile) {
      try {
        const jsonText = await jsonFile.text();
        const payload = parseSelectionClipboardPayload(jsonText);
        if (payload && currentCanvasId && currentLayerId) {
          const pastedPayload = await pasteSelectionToCanvas({
            payload,
            currentCanvasId,
            currentLayerId,
            targetAnchor: getViewportCenterInScene(),
            pasteCount: selectionPasteCountRef.current + 1,
            send,
            onTokenStateChange,
            replaceSelection: activeBoard.replaceSelection,
          });
          if (pastedPayload) {
            selectionClipboardRef.current = pastedPayload;
            selectionPasteCountRef.current += 1;
          }
          return;
        }
      } catch (error) {
        console.error('[SelectionImport] JSON 拖入导入失败:', error);
      }
    }

    const imageFile = files.find((file) => file.type.startsWith('image/'));
    if (!imageFile) return;

    const dropPosition = getExperimentalCanvasPoint(event.clientX, event.clientY);

    if (dropPosition) {
      await addImageToCanvas(imageFile, dropPosition);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return {
    imageInputRef,
    addImageToCanvas,
    handleInsertMarkdown,
    handleInsertImage,
    handleDrop,
    handleDragOver,
  };
};
