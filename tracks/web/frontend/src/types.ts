// ---------------------------------------------------------
// 1. 几何图形定义
// ---------------------------------------------------------
export type ShapeData =
  | { type: 'line'; data: { points: number[]; stroke: string; stroke_width: number; x?: number; y?: number; rotation?: number; scaleX?: number; scaleY?: number } }
  | { type: 'rect'; data: { x: number; y: number; width: number; height: number; stroke: string; fill?: string; rotation?: number; scaleX?: number; scaleY?: number } }
  | { type: 'image'; data: { x: number; y: number; width: number; height: number; src: string; srcResourceId?: string; rotation?: number; scaleX?: number; scaleY?: number } }
  | { type: 'markdown'; data: { x: number; y: number; width: number; height: number; content: string; renderedImage: string; renderedImageResourceId?: string; rotation?: number; scaleX?: number; scaleY?: number } };

// ---------------------------------------------------------
// 2. 动作定义
// ---------------------------------------------------------
export type Action = 
  | { type: 'draw'; payload: { id: string; shape: ShapeData } }
  | { type: 'erase'; payload: { shapeIds: string[]; forceAllTypes?: boolean } }
  | { type: 'update'; payload: { id: string; oldShape: ShapeData; newShape: ShapeData } }
  | { type: 'batchUpdate'; payload: { updates: Array<{ id: string; oldShape: ShapeData; newShape: ShapeData }> } }
  | { type: 'reorder'; payload: { orderedIds: string[] } }
  | { type: 'undo'; payload: null }
  | { type: 'redo'; payload: null }
  | { type: 'clear'; payload: null };

// ---------------------------------------------------------
// 3. Canvas 和 Layer 状态
// ---------------------------------------------------------
export type LayerView = {
  id: string;
  name: string;
  pointer: number;
  history: Action[];
};

export type CanvasView = {
  id: string;
  name: string;
  layers: Record<string, LayerView>;
  layerIds: string[]; // 保证顺序
};

export type LayerSnapshotView = {
  id: string;
  name: string;
  actions: Action[];
  pointer: number;
};

export type CanvasSnapshotView = {
  id: string;
  name: string;
  layers: Record<string, LayerSnapshotView>;
};

export type RoomSnapshotFile = {
  restoreToken?: string | null;
  originalRoomId: string;
  savedAt: string;
  canvases: Record<string, CanvasSnapshotView>;
  resources?: Record<string, unknown>;
  metadata: {
    canvasCount: number;
    totalShapes: number;
    totalResources?: number;
    uniqueResources?: number;
    totalResourceBytes?: number;
    uniqueResourceBytes?: number;
    snapshotInlinePayloadsStripped?: number;
    snapshotInlineBytesStripped?: number;
    saveCount: number;
  };
};

// ---------------------------------------------------------
// 4. Canvas 和 Layer 命令
// ---------------------------------------------------------
export type CanvasCommand = 
  | { type: 'create'; payload: { id: string; name: string } }
  | { type: 'delete'; payload: { id: string } }
  | { type: 'rename'; payload: { id: string; name: string } }
  | { type: 'switch'; payload: { id: string } };

export type LayerCommand = 
  | { type: 'create'; payload: { canvasId: string; layerId: string; name: string } }
  | { type: 'delete'; payload: { canvasId: string; layerId: string } }
  | { type: 'rename'; payload: { canvasId: string; layerId: string; name: string } };

// ---------------------------------------------------------
// 5. 服务端消息
// ---------------------------------------------------------
export type ServerMessage = 
  | { event: 'syncState'; data: { roomId: string; canvases: Record<string, CanvasView>; canvasIds: string[]; restoreToken?: string } }
  | { event: 'broadCast'; data: { canvasId: string; layerId: string; action: Action } }
  | { event: 'canvasUpdate'; data: { command: CanvasCommand } }
  | { event: 'layerUpdate'; data: { command: LayerCommand } }
  | { event: 'roomSaved'; data: { restoreToken: string; savedAt: string; saveCount: number; isUpdate: boolean; message: string } }
  | { event: 'roomClosed'; data: { roomId: string; closedBy: string; message: string } }
  | { event: 'error'; data: { message: string } };

// ---------------------------------------------------------
// 6. 客户端消息
// ---------------------------------------------------------
export type ClientMessage = 
  | { event: 'join' }
  | { event: 'canvasCtrl'; data: CanvasCommand }
  | { event: 'layerOp'; data: { canvasId: string; layerId: string; action: Action } }
  | { event: 'layerCtrl'; data: LayerCommand }
  | { event: 'saveRoom'; data: { forceNewVersion: boolean } }
  | { event: 'closeRoom'; data: { saveBeforeClose: boolean } };
