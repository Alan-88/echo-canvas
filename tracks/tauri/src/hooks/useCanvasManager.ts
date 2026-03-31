/**
 * Canvas/Layer 管理 Hook
 * 处理 Canvas 和 Layer 的 CRUD 操作
 */

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useWhiteboardStore } from '../store/useWhiteboardStore';

export interface CanvasManagerState {
  // Canvas 菜单状态
  canvasMenuOpen: string | null;
  setCanvasMenuOpen: (id: string | null) => void;
  editingCanvasId: string | null;
  editingCanvasName: string;
  
  // Layer 菜单状态
  layerMenuOpen: string | null;
  setLayerMenuOpen: (id: string | null) => void;
  editingLayerId: string | null;
  editingLayerName: string;
  
  // Canvas 操作
  handleCreateCanvas: () => void;
  handleDeleteCanvas: (canvasId: string) => void;
  handleRenameCanvas: (canvasId: string, newName: string) => void;
  startEditingCanvas: (canvasId: string, currentName: string) => void;
  cancelEditingCanvas: () => void;
  
  // Layer 操作
  handleCreateLayer: () => void;
  handleDeleteLayer: (layerId: string) => void;
  handleRenameLayer: (layerId: string, newName: string) => void;
  startEditingLayer: (layerId: string, currentName: string) => void;
  cancelEditingLayer: () => void;
}

export const useCanvasManager = (
  send: (msg: any) => void,
  onTokenStateChange?: (state: 'unsaved') => void
): CanvasManagerState => {
  const canvases = useWhiteboardStore((s) => s.canvases);
  const currentCanvasId = useWhiteboardStore((s) => s.currentCanvasId);
  const createCanvas = useWhiteboardStore((s) => s.createCanvas);
  const deleteCanvas = useWhiteboardStore((s) => s.deleteCanvas);
  const renameCanvas = useWhiteboardStore((s) => s.renameCanvas);
  const switchCanvas = useWhiteboardStore((s) => s.switchCanvas);
  const createLayer = useWhiteboardStore((s) => s.createLayer);
  const deleteLayer = useWhiteboardStore((s) => s.deleteLayer);
  const renameLayer = useWhiteboardStore((s) => s.renameLayer);
  const switchLayer = useWhiteboardStore((s) => s.switchLayer);

  // Canvas 菜单状态
  const [canvasMenuOpen, setCanvasMenuOpen] = useState<string | null>(null);
  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
  const [editingCanvasName, setEditingCanvasName] = useState('');

  // Layer 菜单状态
  const [layerMenuOpen, setLayerMenuOpen] = useState<string | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState('');

  // Canvas 操作
  const handleCreateCanvas = () => {
    const newId = uuidv4();
    const canvasCount = Object.keys(canvases).length;
    const name = `Canvas ${canvasCount + 1}`;

    createCanvas(newId, name);
    switchCanvas(newId);

    send({
      event: 'canvasCtrl',
      data: { type: 'create', payload: { id: newId, name } },
    });
    
    onTokenStateChange?.('unsaved');
  };

  const handleDeleteCanvas = (canvasId: string) => {
    if (Object.keys(canvases).length <= 1) {
      alert('不能删除最后一个 Canvas');
      return;
    }

    if (
      !confirm(
        '确定要删除这个 Canvas 吗？所有图层和绘图数据都将丢失。'
      )
    )
      return;

    deleteCanvas(canvasId);
    send({
      event: 'canvasCtrl',
      data: { type: 'delete', payload: { id: canvasId } },
    });
    
    onTokenStateChange?.('unsaved');
    setCanvasMenuOpen(null);
  };

  const handleRenameCanvas = (canvasId: string, newName: string) => {
    if (newName.trim() && newName !== canvases[canvasId]?.name) {
      renameCanvas(canvasId, newName.trim());
      send({
        event: 'canvasCtrl',
        data: { type: 'rename', payload: { id: canvasId, name: newName.trim() } },
      });
      
      onTokenStateChange?.('unsaved');
    }
    setEditingCanvasId(null);
    setEditingCanvasName('');
  };

  const startEditingCanvas = (canvasId: string, currentName: string) => {
    setEditingCanvasId(canvasId);
    setEditingCanvasName(currentName);
    setCanvasMenuOpen(null);
  };

  const cancelEditingCanvas = () => {
    setEditingCanvasId(null);
    setEditingCanvasName('');
  };

  // Layer 操作
  const handleCreateLayer = () => {
    if (!currentCanvasId || !canvases[currentCanvasId]) return;

    const newId = uuidv4();
    const layerCount = Object.keys(canvases[currentCanvasId].layers).length;
    const name = `Layer ${layerCount + 1}`;

    createLayer(currentCanvasId, newId, name);
    switchLayer(newId);

    send({
      event: 'layerCtrl',
      data: {
        type: 'create',
        payload: { canvasId: currentCanvasId, layerId: newId, name },
      },
    });
    
    onTokenStateChange?.('unsaved');
  };

  const handleDeleteLayer = (layerId: string) => {
    if (!currentCanvasId) return;

    const currentCanvas = canvases[currentCanvasId];
    if (currentCanvas && Object.keys(currentCanvas.layers).length <= 1) {
      alert('不能删除最后一个 Layer');
      return;
    }

    if (
      !confirm('确定要删除这个 Layer 吗？该图层的所有绘图数据都将丢失。')
    )
      return;

    deleteLayer(currentCanvasId, layerId);
    send({
      event: 'layerCtrl',
      data: {
        type: 'delete',
        payload: { canvasId: currentCanvasId, layerId },
      },
    });
    
    onTokenStateChange?.('unsaved');
    setLayerMenuOpen(null);
  };

  const handleRenameLayer = (layerId: string, newName: string) => {
    if (!currentCanvasId) return;

    const currentCanvas = canvases[currentCanvasId];
    if (
      newName.trim() &&
      newName !== currentCanvas?.layers[layerId]?.name
    ) {
      renameLayer(currentCanvasId, layerId, newName.trim());
      send({
        event: 'layerCtrl',
        data: {
          type: 'rename',
          payload: { canvasId: currentCanvasId, layerId, name: newName.trim() },
        },
      });
      
      onTokenStateChange?.('unsaved');
    }
    setEditingLayerId(null);
    setEditingLayerName('');
  };

  const startEditingLayer = (layerId: string, currentName: string) => {
    setEditingLayerId(layerId);
    setEditingLayerName(currentName);
    setLayerMenuOpen(null);
  };

  const cancelEditingLayer = () => {
    setEditingLayerId(null);
    setEditingLayerName('');
  };

  return {
    canvasMenuOpen,
    setCanvasMenuOpen,
    editingCanvasId,
    editingCanvasName,
    layerMenuOpen,
    setLayerMenuOpen,
    editingLayerId,
    editingLayerName,
    handleCreateCanvas,
    handleDeleteCanvas,
    handleRenameCanvas,
    startEditingCanvas,
    cancelEditingCanvas,
    handleCreateLayer,
    handleDeleteLayer,
    handleRenameLayer,
    startEditingLayer,
    cancelEditingLayer,
  };
};
