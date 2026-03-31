import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWhiteboardStore } from '../store/useWhiteboardStore';
import { useSocket } from '../hooks/useSocket';
import { useDrawingTools } from '../hooks/useDrawingTools';
import { useCanvasManager } from '../hooks/useCanvasManager';
import { useRoomActions } from '../hooks/useRoomActions';
import '../styles/markdown.css';
import { useCanvasOverlayBoard } from '../features/canvas-overlay/hooks/useCanvasOverlayBoard';
import { useWhiteboardMediaIO } from '../hooks/useWhiteboardMediaIO';
import { useWhiteboardExportActions } from '../hooks/useWhiteboardExportActions';
import {
  useWhiteboardToolCursor,
  useWhiteboardToolState,
} from '../hooks/useWhiteboardToolState';
import { useStylusMode } from '../hooks/useStylusMode';
import { WhiteboardWorkspace } from './whiteboard/WhiteboardWorkspace';

interface WhiteboardProps {
  roomId?: string;
}

const isEditableEventTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};

export const Whiteboard: React.FC<WhiteboardProps> = ({ roomId }) => {
  const { send } = useSocket(roomId!);

  const canvases = useWhiteboardStore((state) => state.canvases);
  const canvasIds = useWhiteboardStore((state) => state.canvasIds);
  const currentCanvasId = useWhiteboardStore((state) => state.currentCanvasId);
  const currentLayerId = useWhiteboardStore((state) => state.currentLayerId);
  const currentCanvas = currentCanvasId ? canvases[currentCanvasId] : null;

  const allVisibleShapes = useWhiteboardStore(
    useShallow((state) => {
      if (!state.currentCanvasId) return {};
      const canvas = state.canvases[state.currentCanvasId];
      if (!canvas) return {};
      const result: Record<string, any[]> = {};
      for (const layerId of canvas.layerIds) {
        const layer = canvas.layers[layerId];
        if (layer) result[layerId] = layer.visibleShapes;
      }
      return result;
    })
  );

  const {
    tool,
    currentPopup,
    setCurrentPopup,
    handleToolChange,
  } = useWhiteboardToolState();
  const { stylusModeEnabled, setStylusModeEnabled } = useStylusMode();
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  const { penConfig, eraserSize, setPenColor, setPenSize, setEraserSize } = useDrawingTools();
  const roomActions = useRoomActions(roomId!, send);
  const canvasManager = useCanvasManager(send, roomActions.setTokenState);

  const experimentalCanvas = useCanvasOverlayBoard(
    tool,
    penConfig,
    eraserSize,
    currentCanvasId,
    currentLayerId,
    allVisibleShapes,
    send,
    roomActions.setTokenState
  );
  const activeBoard = experimentalCanvas;

  const { effectiveTool, cursor } = useWhiteboardToolCursor({
    tool,
    penConfig,
    eraserSize,
    state: activeBoard,
  });

  const mediaIO = useWhiteboardMediaIO({
    currentCanvasId,
    currentLayerId,
    activeBoard,
    getExperimentalCanvasPoint: experimentalCanvas.getCanvasPointFromClient,
    send,
    onTokenStateChange: roomActions.setTokenState,
  });

  const exportActions = useWhiteboardExportActions({
    layerIds: currentCanvas?.layerIds || [],
    allVisibleShapes,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeBoard.editingMarkdown) return;
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableEventTarget(event.target)) return;

      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        activeBoard.handleZoomOut();
        return;
      }

      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        activeBoard.handleZoomIn();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeBoard.editingMarkdown,
    activeBoard.handleZoomIn,
    activeBoard.handleZoomOut,
  ]);

  useEffect(() => {
    const handleGlobalClick = () => {
      setCurrentPopup(null);
      canvasManager.setCanvasMenuOpen(null);
      canvasManager.setLayerMenuOpen(null);
      if (leftSidebarOpen) setLeftSidebarOpen(false);
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [leftSidebarOpen, canvasManager, setCurrentPopup]);

  const canvasesData = canvasIds.map((id) => ({
    id,
    name: canvases[id]?.name || 'Canvas',
    isActive: id === currentCanvasId,
  }));

  const layersData = currentCanvas
    ? currentCanvas.layerIds.map((id) => ({
        id,
        name: currentCanvas.layers[id]?.name || 'Layer',
        visible: currentCanvas.layers[id]?.visible ?? true,
      }))
    : [];

  const currentCanvasName = currentCanvas?.name || 'Main Board';

  return (
    <WhiteboardWorkspace
      roomId={roomId!}
      tool={tool}
      onToolChange={handleToolChange}
      currentPopup={currentPopup}
      onPopupToggle={setCurrentPopup}
      penConfig={penConfig}
      eraserSize={eraserSize}
      onPenColorChange={setPenColor}
      onPenSizeChange={setPenSize}
      onEraserSizeChange={setEraserSize}
      stylusModeEnabled={stylusModeEnabled}
      onStylusModeChange={setStylusModeEnabled}
      leftSidebarOpen={leftSidebarOpen}
      setLeftSidebarOpen={setLeftSidebarOpen}
      rightSidebarOpen={rightSidebarOpen}
      setRightSidebarOpen={setRightSidebarOpen}
      currentCanvasName={currentCanvasName}
      currentCanvasId={currentCanvasId}
      currentLayerId={currentLayerId}
      canvasesData={canvasesData}
      layersData={layersData}
      roomActions={roomActions}
      canvasManager={canvasManager}
      mediaIO={mediaIO}
      exportActions={exportActions}
      activeBoard={activeBoard}
      experimentalCanvas={experimentalCanvas}
      effectiveTool={effectiveTool}
      cursor={cursor}
    />
  );
};
