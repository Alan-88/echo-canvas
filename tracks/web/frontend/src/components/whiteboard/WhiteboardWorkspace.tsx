import React from 'react';
import { useWhiteboardStore } from '../../store/useWhiteboardStore';
import { Header } from './Header';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { ZoomControls } from './ZoomControls';
import { MarkdownEditor } from './MarkdownEditor';
import { RoomDialogs } from './RoomDialogs';
import { CanvasOverlaySurface } from '../../features/canvas-overlay/components/CanvasOverlaySurface';

type Tool = 'pen' | 'eraser' | 'select' | 'pan';

interface CanvasListItem {
  id: string;
  name: string;
  isActive: boolean;
}

interface LayerListItem {
  id: string;
  name: string;
  visible: boolean;
}

interface WhiteboardWorkspaceProps {
  roomId: string;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  currentPopup: 'pen' | 'eraser' | null;
  onPopupToggle: (popup: 'pen' | 'eraser' | null) => void;
  penConfig: { color: string; size: number };
  eraserSize: number;
  onPenColorChange: (color: string) => void;
  onPenSizeChange: (size: number) => void;
  onEraserSizeChange: (size: number) => void;
  stylusModeEnabled: boolean;
  onStylusModeChange: (enabled: boolean) => void;
  leftSidebarOpen: boolean;
  setLeftSidebarOpen: (open: boolean) => void;
  rightSidebarOpen: boolean;
  setRightSidebarOpen: (open: boolean) => void;
  currentCanvasName: string;
  currentCanvasId: string | null;
  currentLayerId: string | null;
  canvasesData: CanvasListItem[];
  layersData: LayerListItem[];
  roomActions: any;
  canvasManager: any;
  mediaIO: any;
  exportActions: any;
  activeBoard: any;
  experimentalCanvas: any;
  effectiveTool: Tool;
  cursor: string;
}

export const WhiteboardWorkspace: React.FC<WhiteboardWorkspaceProps> = ({
  roomId,
  tool,
  onToolChange,
  currentPopup,
  onPopupToggle,
  penConfig,
  eraserSize,
  onPenColorChange,
  onPenSizeChange,
  onEraserSizeChange,
  stylusModeEnabled,
  onStylusModeChange,
  leftSidebarOpen,
  setLeftSidebarOpen,
  rightSidebarOpen,
  setRightSidebarOpen,
  currentCanvasName,
  currentCanvasId,
  currentLayerId,
  canvasesData,
  layersData,
  roomActions,
  canvasManager,
  mediaIO,
  exportActions,
  activeBoard,
  experimentalCanvas,
  effectiveTool,
  cursor,
}) => (
  <div
    className="h-[100dvh] w-screen bg-[#F8F6FC] overflow-hidden flex flex-col relative"
    onClick={() => {
      onPopupToggle(null);
      if (leftSidebarOpen) setLeftSidebarOpen(false);
    }}
    onDrop={mediaIO.handleDrop}
    onDragOver={mediaIO.handleDragOver}
  >
    <Header
      tool={tool}
      onToolChange={onToolChange}
      currentPopup={currentPopup}
      onPopupToggle={onPopupToggle}
      penConfig={penConfig}
      eraserSize={eraserSize}
      onPenColorChange={onPenColorChange}
      onPenSizeChange={onPenSizeChange}
      onEraserSizeChange={onEraserSizeChange}
      onUndo={activeBoard.handleUndo}
      onRedo={activeBoard.handleRedo}
      onClear={activeBoard.handleClear}
      currentCanvasName={currentCanvasName}
      onCanvasNameClick={() => setRightSidebarOpen(!rightSidebarOpen)}
      onLeftSidebarToggle={() => setLeftSidebarOpen(!leftSidebarOpen)}
      tokenState={roomActions.tokenState}
      onInsertMarkdown={mediaIO.handleInsertMarkdown}
      onInsertImage={mediaIO.handleInsertImage}
    />

    <LeftSidebar
      isOpen={leftSidebarOpen}
      roomId={roomId}
      tokenState={roomActions.tokenState}
      savedToken={roomActions.savedToken}
      stylusModeEnabled={stylusModeEnabled}
      onCopyRoomId={() => roomActions.handleCopyRoomId(roomId)}
      onCopyToken={roomActions.handleCopyToken}
      onStylusModeChange={onStylusModeChange}
      onSaveRoom={roomActions.handleSaveRoom}
      onExportPNG={exportActions.handleExportPNG}
      onExportWhiteboard={roomActions.handleExportWhiteboard}
      onLeaveRoom={roomActions.handleLeaveRoom}
      onCloseRoom={roomActions.handleCloseRoom}
    />

    <RightSidebar
      isOpen={rightSidebarOpen}
      canvases={canvasesData}
      layers={layersData}
      currentLayerId={currentLayerId}
      onCanvasSelect={(canvasId: string) => {
        const switchCanvas = useWhiteboardStore.getState().switchCanvas;
        switchCanvas(canvasId);
      }}
      onCanvasCreate={canvasManager.handleCreateCanvas}
      onCanvasRename={(canvasId: string, newName: string) => {
        if (currentCanvasId) {
          const renameCanvas = useWhiteboardStore.getState().renameCanvas;
          renameCanvas(canvasId, newName);
        }
      }}
      onCanvasDelete={(canvasId: string) => {
        const deleteCanvas = useWhiteboardStore.getState().deleteCanvas;
        deleteCanvas(canvasId);
      }}
      onLayerSelect={(layerId: string) => {
        const switchLayer = useWhiteboardStore.getState().switchLayer;
        switchLayer(layerId);
      }}
      onLayerCreate={canvasManager.handleCreateLayer}
      onLayerToggleVisibility={(layerId: string) => {
        if (currentCanvasId) {
          const toggleLayerVisibility = useWhiteboardStore.getState().toggleLayerVisibility;
          toggleLayerVisibility(currentCanvasId, layerId);
        }
      }}
      onLayerRename={(layerId: string, newName: string) => {
        if (currentCanvasId) {
          const renameLayer = useWhiteboardStore.getState().renameLayer;
          renameLayer(currentCanvasId, layerId, newName);
        }
      }}
      onLayerDelete={(layerId: string) => {
        if (currentCanvasId) {
          const deleteLayer = useWhiteboardStore.getState().deleteLayer;
          deleteLayer(currentCanvasId, layerId);
        }
      }}
    />

    <ZoomControls
      scale={activeBoard.stageScale}
      onZoomIn={activeBoard.handleZoomIn}
      onZoomOut={activeBoard.handleZoomOut}
      onResetZoom={activeBoard.handleResetZoom}
    />

    <MarkdownEditor
      isOpen={!!activeBoard.editingMarkdown}
      initialContent={activeBoard.editingMarkdown?.content || ''}
      position={{
        x: activeBoard.editingMarkdown?.x || 0,
        y: activeBoard.editingMarkdown?.y || 0,
        width: activeBoard.editingMarkdown?.width || 300,
        height: activeBoard.editingMarkdown?.height || 100,
      }}
      stageScale={activeBoard.stageScale}
      stagePos={activeBoard.stagePos}
      onChange={activeBoard.handleMarkdownContentChange}
      onResize={({ width, height }) => {
        activeBoard.setEditingMarkdown((previous: any) =>
          previous
            ? {
                ...previous,
                width,
                height,
              }
            : previous
        );
      }}
      onSave={activeBoard.handleSaveMarkdown}
      onCancel={() => activeBoard.setEditingMarkdown(null)}
    />

    <RoomDialogs
      closeDialogOpen={roomActions.showCloseDialog}
      onCancelClose={() => roomActions.setShowCloseDialog(false)}
      onSaveAndClose={() => roomActions.confirmClose('save')}
      onCloseWithoutSave={() => roomActions.confirmClose('direct')}
      closeResult={roomActions.closeResult}
      closeResultCopied={roomActions.closeResultCopied}
      onCopyCloseResultToken={() => {
        void roomActions.handleCopyCloseResultToken();
      }}
      onDismissCloseResult={roomActions.dismissCloseResult}
    />

    <div
      className="absolute inset-0 opacity-20 pointer-events-none"
      style={{
        backgroundImage: 'radial-gradient(#827BB9 1.5px, transparent 1.5px)',
        backgroundSize: '24px 24px',
      }}
    />

    <CanvasOverlaySurface
      board={experimentalCanvas}
      effectiveTool={effectiveTool}
      stylusModeEnabled={stylusModeEnabled}
      penConfig={penConfig}
      cursor={cursor}
      onEditMarkdown={(data) => {
        experimentalCanvas.setEditingMarkdown(data);
      }}
    />

    <input
      ref={mediaIO.imageInputRef}
      type="file"
      accept="image/*"
      style={{ display: 'none' }}
      onChange={async (event) => {
        const file = event.target.files?.[0];
        if (file) {
          await mediaIO.addImageToCanvas(file);
        }
        event.target.value = '';
      }}
    />
  </div>
);
