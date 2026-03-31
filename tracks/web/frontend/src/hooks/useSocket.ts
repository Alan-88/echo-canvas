import { useEffect, useRef } from 'react';
import { useWhiteboardStore } from '../store/useWhiteboardStore';
import type { ServerMessage, ClientMessage } from '../types';
import {
  decodeServerFrame,
  encodeClientFrame,
  getWsMessageCodecMode,
  resolveClientFrameCodecMode,
} from '../utils/wsMessageCodec';
import { buildWebSocketUrl } from '../utils/runtimeNetwork';

export const useSocket = (roomId: string) => {
  const socketRef = useRef<WebSocket | null>(null);
  const hasInitializedRef = useRef(false); // 防止 StrictMode 重复初始化
  const wsCodecModeRef = useRef(getWsMessageCodecMode());
  const pendingLayerEchoRef = useRef<Map<string, { count: number; timestamp: number }>>(
    new Map()
  );
  const ECHO_TTL_MS = 15_000;

  const stableSerialize = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(',')}}`;
  };

  const buildLayerOpSignature = (
    canvasId: string,
    layerId: string,
    action: any
  ): string => `${canvasId}|${layerId}|${stableSerialize(action)}`;

  const cleanupExpiredPendingEcho = () => {
    const now = Date.now();
    for (const [signature, item] of pendingLayerEchoRef.current.entries()) {
      if (now - item.timestamp > ECHO_TTL_MS) {
        pendingLayerEchoRef.current.delete(signature);
      }
    }
  };

  const trackPendingLayerEcho = (canvasId: string, layerId: string, action: any) => {
    cleanupExpiredPendingEcho();
    const signature = buildLayerOpSignature(canvasId, layerId, action);
    const prev = pendingLayerEchoRef.current.get(signature);
    pendingLayerEchoRef.current.set(signature, {
      count: (prev?.count || 0) + 1,
      timestamp: Date.now(),
    });
  };

  const consumePendingLayerEcho = (
    canvasId: string,
    layerId: string,
    action: any
  ): boolean => {
    cleanupExpiredPendingEcho();
    const signature = buildLayerOpSignature(canvasId, layerId, action);
    const item = pendingLayerEchoRef.current.get(signature);
    if (!item || item.count <= 0) return false;

    if (item.count === 1) {
      pendingLayerEchoRef.current.delete(signature);
    } else {
      pendingLayerEchoRef.current.set(signature, {
        count: item.count - 1,
        timestamp: item.timestamp,
      });
    }
    return true;
  };
  
  // 🔧 使用 useRef 保存 store 方法的稳定引用
  const storeRef = useRef({
    initRoom: useWhiteboardStore.getState().initRoom,
    applyDraw: useWhiteboardStore.getState().applyDraw,
    applyErase: useWhiteboardStore.getState().applyErase,
    applyUpdate: useWhiteboardStore.getState().applyUpdate,
    applyBatchUpdate: useWhiteboardStore.getState().applyBatchUpdate,
    applyReorder: useWhiteboardStore.getState().applyReorder,
    applyUndo: useWhiteboardStore.getState().applyUndo,
    applyRedo: useWhiteboardStore.getState().applyRedo,
    createCanvas: useWhiteboardStore.getState().createCanvas,
    deleteCanvas: useWhiteboardStore.getState().deleteCanvas,
    renameCanvas: useWhiteboardStore.getState().renameCanvas,
    createLayer: useWhiteboardStore.getState().createLayer,
    deleteLayer: useWhiteboardStore.getState().deleteLayer,
    renameLayer: useWhiteboardStore.getState().renameLayer,
  });

  // 更新 ref 以保持最新的方法引用
  useEffect(() => {
    storeRef.current = {
      initRoom: useWhiteboardStore.getState().initRoom,
      applyDraw: useWhiteboardStore.getState().applyDraw,
      applyErase: useWhiteboardStore.getState().applyErase,
      applyUpdate: useWhiteboardStore.getState().applyUpdate,
      applyBatchUpdate: useWhiteboardStore.getState().applyBatchUpdate,
      applyReorder: useWhiteboardStore.getState().applyReorder,
      applyUndo: useWhiteboardStore.getState().applyUndo,
      applyRedo: useWhiteboardStore.getState().applyRedo,
      createCanvas: useWhiteboardStore.getState().createCanvas,
      deleteCanvas: useWhiteboardStore.getState().deleteCanvas,
      renameCanvas: useWhiteboardStore.getState().renameCanvas,
      createLayer: useWhiteboardStore.getState().createLayer,
      deleteLayer: useWhiteboardStore.getState().deleteLayer,
      renameLayer: useWhiteboardStore.getState().renameLayer,
    };
  });

  useEffect(() => {
    // 🔒 安全检查：如果 roomId 无效，不建立连接
    if (!roomId || roomId === 'undefined') {
      console.warn('[useSocket] Invalid roomId, skipping connection:', roomId);
      return;
    }

    // 🔒 防止 React StrictMode 重复初始化
    if (hasInitializedRef.current) {
      console.warn('[useSocket] Already initialized, skipping duplicate connection');
      return;
    }
    hasInitializedRef.current = true;

    const WS_URL = buildWebSocketUrl(roomId);
    const ws = new WebSocket(WS_URL);
    ws.binaryType = 'arraybuffer';
    socketRef.current = ws;

    ws.onopen = () => {
      const frame = encodeClientFrame({ event: 'join' }, wsCodecModeRef.current);
      ws.send(frame);
    };

    ws.onmessage = async (event) => {
      try {
        const msg: ServerMessage = await decodeServerFrame(event.data);
        
        // 2. 消息分发 (Dispatcher)
        switch (msg.event) {
          case 'syncState':
            // 检查是否有待导入的数据，如果有就跳过initRoom（避免覆盖导入数据）
            const importKey = `pending_import_${roomId}`;
            const hasPendingImport = sessionStorage.getItem(importKey);
            
            if (hasPendingImport) {
              // 不调用initRoom，Whiteboard的useEffect已经处理了导入
              // 清除sessionStorage，避免重复导入
              sessionStorage.removeItem(importKey);
            } else {
              // 正常情况：初始化房间数据
              storeRef.current.initRoom(msg.data.roomId, msg.data.canvases, msg.data.canvasIds);
            }
            
            // 如果房间有关联的token，触发事件通知UI组件
            if (msg.data.restoreToken) {
              window.dispatchEvent(new CustomEvent('roomTokenRestored', { 
                detail: { restoreToken: msg.data.restoreToken } 
              }));
            }
            break;

          case 'broadCast':
            const { canvasId, layerId, action } = msg.data;
            if (consumePendingLayerEcho(canvasId, layerId, action)) {
              break;
            }
            // 收到广播时，更新本地 Store - 使用 ref 中的方法
            switch (action.type) {
              case 'draw': 
                storeRef.current.applyDraw(canvasId, layerId, action); 
                break;
              case 'erase': 
                storeRef.current.applyErase(canvasId, layerId, action); 
                break;
              case 'update':
                storeRef.current.applyUpdate(canvasId, layerId, action);
                break;
              case 'batchUpdate':
                storeRef.current.applyBatchUpdate(canvasId, layerId, action);
                break;
              case 'reorder':
                storeRef.current.applyReorder(canvasId, layerId, action);
                break;
              case 'undo': 
                storeRef.current.applyUndo(canvasId, layerId); 
                break;
              case 'redo': 
                storeRef.current.applyRedo(canvasId, layerId); 
                break;
            }
            break;

          case 'canvasUpdate':
            // 处理 Canvas 管理更新 - 使用 ref 中的方法
            const canvasCmd = msg.data.command;
            switch (canvasCmd.type) {
              case 'create':
                storeRef.current.createCanvas(canvasCmd.payload.id, canvasCmd.payload.name);
                break;
              case 'delete':
                storeRef.current.deleteCanvas(canvasCmd.payload.id);
                break;
              case 'rename':
                storeRef.current.renameCanvas(canvasCmd.payload.id, canvasCmd.payload.name);
                break;
            }
            break;

          case 'layerUpdate':
            // 处理图层管理更新 - 使用 ref 中的方法
            const layerCmd = msg.data.command;
            switch (layerCmd.type) {
              case 'create':
                storeRef.current.createLayer(
                  layerCmd.payload.canvasId,
                  layerCmd.payload.layerId,
                  layerCmd.payload.name
                );
                break;
              case 'delete':
                storeRef.current.deleteLayer(
                  layerCmd.payload.canvasId,
                  layerCmd.payload.layerId
                );
                break;
              case 'rename':
                storeRef.current.renameLayer(
                  layerCmd.payload.canvasId,
                  layerCmd.payload.layerId,
                  layerCmd.payload.name
                );
                break;
            }
            break;

          case 'roomSaved':
            window.dispatchEvent(new CustomEvent('roomSaved', { detail: msg.data }));
            break;

          case 'roomClosed':
            window.dispatchEvent(new CustomEvent('roomClosed', { detail: msg.data }));
            break;

          case 'error':
            // 错误消息
            console.error('❌ Server error:', msg.data.message);
            // 触发自定义事件，由UI组件监听
            window.dispatchEvent(new CustomEvent('serverError', { detail: msg.data }));
            break;
        }
      } catch (e) {
        console.error('Parse Error:', e);
      }
    };

    ws.onclose = () => {};

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      console.error('[useSocket] WebSocket URL was:', WS_URL);
      console.error('[useSocket] Room ID was:', roomId);
    };

    return () => {
      hasInitializedRef.current = false; // 重置标志
      pendingLayerEchoRef.current.clear();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [roomId]); // ✅ 只依赖 roomId，避免重复创建连接

  // 3. 暴露发送方法给 UI 组件
  const send = (msg: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      if (msg.event === 'layerOp') {
        trackPendingLayerEcho(msg.data.canvasId, msg.data.layerId, msg.data.action);
      }
      const frame = encodeClientFrame(msg, resolveClientFrameCodecMode(msg));
      socketRef.current.send(frame);
    }
  };

  return { send };
};
