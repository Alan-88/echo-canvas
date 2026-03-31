import { useEffect } from 'react';
import type { ShapeData } from '../types';
import { useWhiteboardStore } from '../store/useWhiteboardStore';
import { buildAutoSelectionReorderAction } from '../features/canvas-overlay/utils/selectionAutoReorder';

const EMPTY_SHAPES: Array<{ id: string; shape: ShapeData }> = [];

interface UseSelectionAutoReorderSyncOptions {
  isExperimental: boolean;
  currentCanvasId: string | null;
  currentLayerId: string | null;
  hasSelection: boolean;
  selectedIds: string[];
  send: (msg: any) => void;
  onTokenStateChange: (state: 'unsaved') => void;
}

export const useSelectionAutoReorderSync = ({
  isExperimental,
  currentCanvasId,
  currentLayerId,
  hasSelection,
  selectedIds,
  send,
  onTokenStateChange,
}: UseSelectionAutoReorderSyncOptions) => {
  const currentLayerShapes = useWhiteboardStore((state) => {
    if (!currentCanvasId || !currentLayerId) return EMPTY_SHAPES;
    const canvas = state.canvases[currentCanvasId];
    if (!canvas) return EMPTY_SHAPES;
    const layer = canvas.layers[currentLayerId];
    if (!layer) return EMPTY_SHAPES;
    return layer.visibleShapes;
  });
  const applyReorder = useWhiteboardStore((state) => state.applyReorder);

  useEffect(() => {
    if (!isExperimental) return;
    if (!currentCanvasId || !currentLayerId) return;
    if (!hasSelection) return;

    const action = buildAutoSelectionReorderAction(currentLayerShapes, selectedIds);
    if (!action) return;

    applyReorder(currentCanvasId, currentLayerId, action);
    send({
      event: 'layerOp',
      data: { canvasId: currentCanvasId, layerId: currentLayerId, action },
    });
    onTokenStateChange('unsaved');
  }, [
    applyReorder,
    currentCanvasId,
    currentLayerId,
    currentLayerShapes,
    hasSelection,
    isExperimental,
    onTokenStateChange,
    selectedIds,
    send,
  ]);
};
