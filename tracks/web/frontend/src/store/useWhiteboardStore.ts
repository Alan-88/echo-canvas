// frontend/src/store/useWhiteboardStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Action, ShapeData, CanvasView } from '../types';
import { normalizeEraseShapeIds } from '../utils/shapePolicy';
import {
  isDuplicateDrawActionAtPointer,
  isDuplicateEraseActionAtPointer,
  isDuplicateReorderActionAtPointer,
} from './storeActionIdempotency';
import { rebuildVisibleLayerShapes } from './layerHistoryReducer';

// 为了方便通过 ID 删除，我们需要给每个 shape 附加 ID
interface ShapeWithId {
  id: string;
  shape: ShapeData;
}

// Layer 状态
interface LayerState {
  id: string;
  name: string;
  visible: boolean;  // 图层可见性
  history: Action[];
  pointer: number;
  visibleShapes: ShapeWithId[];
}

// Canvas 状态
interface CanvasState {
  id: string;
  name: string;
  layers: Record<string, LayerState>;
  layerIds: string[];
}

interface WhiteboardState {
  // --- 房间信息 ---
  roomId: string | null;
  
  // --- Canvas 数据 ---
  canvases: Record<string, CanvasState>;
  canvasIds: string[];
  currentCanvasId: string | null;
  
  // --- Layer 数据 ---
  currentLayerId: string | null;

  // --- 初始化动作 ---
  initRoom: (roomId: string, canvases: Record<string, CanvasView>, canvasIds: string[]) => void;
  
  // --- 直接设置方法（用于导入） ---
  setCanvases: (canvases: Record<string, CanvasState>) => void;
  setCurrentCanvasId: (id: string | null) => void;
  setCurrentLayerId: (id: string | null) => void;
  
  // --- Canvas 管理 ---
  createCanvas: (id: string, name: string) => void;
  switchCanvas: (id: string) => void;
  deleteCanvas: (id: string) => void;
  renameCanvas: (id: string, name: string) => void;
  
  // --- Layer 管理 ---
  createLayer: (canvasId: string, layerId: string, name: string) => void;
  switchLayer: (layerId: string) => void;
  deleteLayer: (canvasId: string, layerId: string) => void;
  renameLayer: (canvasId: string, layerId: string, name: string) => void;
  toggleLayerVisibility: (canvasId: string, layerId: string) => void;
  
  // --- 绘图动作 ---
  applyDraw: (canvasId: string, layerId: string, action: Action) => void;
  applyErase: (canvasId: string, layerId: string, action: Action) => void;
  applyUpdate: (canvasId: string, layerId: string, action: Action) => void;
  applyBatchUpdate: (canvasId: string, layerId: string, action: Action) => void;
  applyReorder: (canvasId: string, layerId: string, action: Action) => void;
  applyUndo: (canvasId: string, layerId: string) => void;
  applyRedo: (canvasId: string, layerId: string) => void;
}

// 默认 Layer ID（用于新建Canvas时的默认图层）
const DEFAULT_LAYER_ID = '00000000-0000-0000-0000-000000000001';

// 防重复处理
let lastUndoRedoTimestamp: Record<string, { type: 'undo' | 'redo', timestamp: number }> = {};

export const useWhiteboardStore = create(
  immer<WhiteboardState>((set, _get) => ({
    roomId: null,
    canvases: {},
    canvasIds: [],
    currentCanvasId: null,
    currentLayerId: null,

    // 初始化房间（收到 SyncState 时调用）
    initRoom: (roomId, canvasViews, canvasIds) => set((state) => {
      state.roomId = roomId;
      state.canvases = {};
      state.canvasIds = canvasIds; // 使用服务端提供的顺序
      
      // 按照 canvasIds 的顺序遍历
      for (const canvasId of canvasIds) {
        const canvasView = canvasViews[canvasId];
        if (!canvasView) continue;
        
        const layers: Record<string, LayerState> = {};
        const layerIds = canvasView.layerIds; // 使用服务端提供的顺序
        
        // 按照 layerIds 的顺序遍历
        for (const layerId of layerIds) {
          const layerView = canvasView.layers[layerId];
          if (!layerView) continue;
          
          layers[layerId] = {
            id: layerView.id,
            name: layerView.name,
            visible: true,  // 默认可见
            history: layerView.history,
            pointer: layerView.pointer,
            visibleShapes: rebuildVisibleLayerShapes(layerView.history, layerView.pointer),
          };
        }
        
        state.canvases[canvasId] = {
          id: canvasView.id,
          name: canvasView.name,
          layers,
          layerIds,
        };
      }
      
      // 设置默认当前 Canvas 和 Layer
      if (state.canvasIds.length > 0) {
        state.currentCanvasId = state.canvasIds[0];
        const firstCanvas = state.canvases[state.canvasIds[0]];
        if (firstCanvas.layerIds.length > 0) {
          state.currentLayerId = firstCanvas.layerIds[0];
        }
      }
    }),

    // 直接设置方法（用于导入）
    setCanvases: (canvases) => set((state) => {
      state.canvases = canvases;
      // 更新 canvasIds
      state.canvasIds = Object.keys(canvases);
    }),

    setCurrentCanvasId: (id) => set((state) => {
      state.currentCanvasId = id;
    }),

    setCurrentLayerId: (id) => set((state) => {
      state.currentLayerId = id;
    }),

    // Canvas 管理
    createCanvas: (id, name) => set((state) => {
      if (!state.canvases[id]) {
        state.canvases[id] = {
          id,
          name,
          layers: {
            [DEFAULT_LAYER_ID]: {
              id: DEFAULT_LAYER_ID,
              name: 'Layer 1',
              visible: true,
              history: [],
              pointer: 0,
              visibleShapes: [],
            }
          },
          layerIds: [DEFAULT_LAYER_ID],
        };
        state.canvasIds.push(id);
      }
    }),

    switchCanvas: (id) => set((state) => {
      if (state.canvases[id]) {
        state.currentCanvasId = id;
        // 切换到该 Canvas 的第一个 Layer
        const canvas = state.canvases[id];
        if (canvas.layerIds.length > 0) {
          state.currentLayerId = canvas.layerIds[0];
        }
      }
    }),

    deleteCanvas: (id) => set((state) => {
      const index = state.canvasIds.indexOf(id);
      if (index > -1) {
        state.canvasIds.splice(index, 1);
        delete state.canvases[id];
        
        // 如果删除的是当前 Canvas，切换到第一个
        if (state.currentCanvasId === id && state.canvasIds.length > 0) {
          state.currentCanvasId = state.canvasIds[0];
          const canvas = state.canvases[state.canvasIds[0]];
          if (canvas.layerIds.length > 0) {
            state.currentLayerId = canvas.layerIds[0];
          }
        }
      }
    }),

    renameCanvas: (id, name) => set((state) => {
      if (state.canvases[id]) {
        state.canvases[id].name = name;
      }
    }),

    // Layer 管理
    createLayer: (canvasId, layerId, name) => set((state) => {
      const canvas = state.canvases[canvasId];
      if (canvas && !canvas.layers[layerId]) {
        canvas.layers[layerId] = {
          id: layerId,
          name,
          visible: true,
          history: [],
          pointer: 0,
          visibleShapes: [],
        };
        canvas.layerIds.push(layerId);
      }
    }),

    switchLayer: (layerId) => set((state) => {
      state.currentLayerId = layerId;
    }),

    deleteLayer: (canvasId, layerId) => set((state) => {
      const canvas = state.canvases[canvasId];
      if (canvas) {
        const index = canvas.layerIds.indexOf(layerId);
        if (index > -1) {
          canvas.layerIds.splice(index, 1);
          delete canvas.layers[layerId];
          
          // 如果删除的是当前 Layer，切换到第一个
          if (state.currentLayerId === layerId && canvas.layerIds.length > 0) {
            state.currentLayerId = canvas.layerIds[0];
          }
        }
      }
    }),

    renameLayer: (canvasId, layerId, name) => set((state) => {
      const canvas = state.canvases[canvasId];
      if (canvas && canvas.layers[layerId]) {
        canvas.layers[layerId].name = name;
      }
    }),

    toggleLayerVisibility: (canvasId, layerId) => set((state) => {
      const canvas = state.canvases[canvasId];
      if (canvas && canvas.layers[layerId]) {
        canvas.layers[layerId].visible = !canvas.layers[layerId].visible;
      }
    }),

    // 绘图动作
    applyDraw: (canvasId, layerId, action) => set((state) => {
      const canvas = state.canvases[canvasId];
      if (!canvas) {
        console.warn(`Canvas ${canvasId} not found, ignoring draw action`);
        return;
      }
      
      const layer = canvas.layers[layerId];
      if (!layer) {
        console.warn(`Layer ${layerId} not found in canvas ${canvasId}, ignoring draw action`);
        return;
      }
      if (action.type !== 'draw') return;

      // 幂等性检查
      if (isDuplicateDrawActionAtPointer(layer.history, layer.pointer, action)) {
        return;
      }

      // 历史重写
      if (layer.pointer < layer.history.length) {
        layer.history = layer.history.slice(0, layer.pointer);
      }

      layer.history.push(action);
      layer.pointer++;
      layer.visibleShapes = rebuildVisibleLayerShapes(layer.history, layer.pointer);
    }),

    applyErase: (canvasId, layerId, action) => set((state) => {
      const canvas = state.canvases[canvasId];
      if (!canvas) return;
      
      const layer = canvas.layers[layerId];
      if (!layer) return;
      if (action.type !== 'erase') return;

      const normalizedIds = normalizeEraseShapeIds(
        action.payload.shapeIds,
        layer.visibleShapes,
        action.payload.forceAllTypes
      );
      if (normalizedIds.length === 0) return;
      const normalizedAction: Action = {
        type: 'erase',
        payload: {
          shapeIds: normalizedIds,
          forceAllTypes: action.payload.forceAllTypes,
        },
      };

      // 幂等性检查
      if (isDuplicateEraseActionAtPointer(layer.history, layer.pointer, normalizedAction)) {
        return;
      }

      if (layer.pointer < layer.history.length) {
        layer.history = layer.history.slice(0, layer.pointer);
      }

      layer.history.push(normalizedAction);
      layer.pointer++;
      layer.visibleShapes = rebuildVisibleLayerShapes(layer.history, layer.pointer);
    }),

    applyUpdate: (canvasId, layerId, action) => set((state) => {
      const canvas = state.canvases[canvasId];
      if (!canvas) return;
      
      const layer = canvas.layers[layerId];
      if (!layer) return;

      // 幂等性检查
      if (action.type === 'update' && layer.pointer > 0 && layer.history.length > 0) {
        const lastAction = layer.history[layer.pointer - 1];
        if (lastAction.type === 'update' && lastAction.payload.id === action.payload.id) {
          const lastNewShape = JSON.stringify(lastAction.payload.newShape);
          const currentNewShape = JSON.stringify(action.payload.newShape);
          if (lastNewShape === currentNewShape) return;
        }
      }

      if (layer.pointer < layer.history.length) {
        layer.history = layer.history.slice(0, layer.pointer);
      }

      layer.history.push(action);
      layer.pointer++;
      layer.visibleShapes = rebuildVisibleLayerShapes(layer.history, layer.pointer);
    }),

    applyBatchUpdate: (canvasId, layerId, action) => set((state) => {
      const canvas = state.canvases[canvasId];
      if (!canvas) return;
      
      const layer = canvas.layers[layerId];
      if (!layer) return;

      // 幂等性检查
      if (action.type === 'batchUpdate' && layer.pointer > 0) {
        const lastAction = layer.history[layer.pointer - 1];
        if (lastAction.type === 'batchUpdate') {
          const lastPayload = JSON.stringify(lastAction.payload);
          const currentPayload = JSON.stringify(action.payload);
          if (lastPayload === currentPayload) return;
        }
      }

      if (layer.pointer < layer.history.length) {
        layer.history = layer.history.slice(0, layer.pointer);
      }

      layer.history.push(action);
      layer.pointer++;
      layer.visibleShapes = rebuildVisibleLayerShapes(layer.history, layer.pointer);
    }),

    applyReorder: (canvasId, layerId, action) => set((state) => {
      const canvas = state.canvases[canvasId];
      if (!canvas) return;

      const layer = canvas.layers[layerId];
      if (!layer) return;
      if (action.type !== 'reorder') return;

      const visibleIdSet = new Set(layer.visibleShapes.map((shape) => shape.id));
      const seen = new Set<string>();
      const normalizedOrderedIds = action.payload.orderedIds
        .filter((id) => visibleIdSet.has(id))
        .filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });

      if (normalizedOrderedIds.length === 0) return;
      const normalizedAction: Action = {
        type: 'reorder',
        payload: {
          orderedIds: normalizedOrderedIds,
        },
      };

      if (isDuplicateReorderActionAtPointer(layer.history, layer.pointer, normalizedAction)) {
        return;
      }

      if (layer.pointer < layer.history.length) {
        layer.history = layer.history.slice(0, layer.pointer);
      }

      layer.history.push(normalizedAction);
      layer.pointer++;
      layer.visibleShapes = rebuildVisibleLayerShapes(layer.history, layer.pointer);
    }),

    applyUndo: (canvasId, layerId) => set((state) => {
      const canvas = state.canvases[canvasId];
      if (!canvas) return;
      
      const layer = canvas.layers[layerId];
      if (!layer || layer.pointer <= 0) return;

      // 防重复
      const key = `${canvasId}-${layerId}`;
      const now = Date.now();
      const lastOp = lastUndoRedoTimestamp[key];
      if (lastOp && lastOp.type === 'undo' && now - lastOp.timestamp < 500) {
        return;
      }

      layer.pointer--;
      lastUndoRedoTimestamp[key] = { type: 'undo', timestamp: now };
      layer.visibleShapes = rebuildVisibleLayerShapes(layer.history, layer.pointer);
    }),

    applyRedo: (canvasId, layerId) => set((state) => {
      const canvas = state.canvases[canvasId];
      if (!canvas) return;
      
      const layer = canvas.layers[layerId];
      if (!layer || layer.pointer >= layer.history.length) return;

      // 防重复
      const key = `${canvasId}-${layerId}`;
      const now = Date.now();
      const lastOp = lastUndoRedoTimestamp[key];
      if (lastOp && lastOp.type === 'redo' && now - lastOp.timestamp < 500) {
        return;
      }

      layer.pointer++;
      lastUndoRedoTimestamp[key] = { type: 'redo', timestamp: now };
      layer.visibleShapes = rebuildVisibleLayerShapes(layer.history, layer.pointer);
    }),

  }))
);

// Undo/Redo 状态选择器
export const canUndo = (state: WhiteboardState): boolean => {
  const { currentCanvasId, currentLayerId, canvases } = state;
  if (!currentCanvasId || !currentLayerId) return false;
  const canvas = canvases[currentCanvasId];
  if (!canvas) return false;
  const layer = canvas.layers[currentLayerId];
  if (!layer) return false;
  return layer.pointer > 0;
};

export const canRedo = (state: WhiteboardState): boolean => {
  const { currentCanvasId, currentLayerId, canvases } = state;
  if (!currentCanvasId || !currentLayerId) return false;
  const canvas = canvases[currentCanvasId];
  if (!canvas) return false;
  const layer = canvas.layers[currentLayerId];
  if (!layer) return false;
  return layer.pointer < layer.history.length;
};
