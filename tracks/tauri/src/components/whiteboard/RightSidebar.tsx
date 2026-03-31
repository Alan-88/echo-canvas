import React, { useState } from 'react';
import { FloatingSidebarShell } from './FloatingSidebarShell';
import { RightSidebarSection } from './RightSidebarSection';
import { RightSidebarActionMenu } from './RightSidebarActionMenu';

interface Canvas {
  id: string;
  name: string;
  isActive: boolean;
}

interface Layer {
  id: string;
  name: string;
  visible: boolean;
}

interface RightSidebarProps {
  isOpen: boolean;
  canvases: Canvas[];
  layers: Layer[];
  currentLayerId: string | null;
  onCanvasSelect: (canvasId: string) => void;
  onCanvasCreate: () => void;
  onCanvasRename: (canvasId: string, newName: string) => void;
  onCanvasDelete: (canvasId: string) => void;
  onLayerSelect: (layerId: string) => void;
  onLayerCreate: () => void;
  onLayerToggleVisibility: (layerId: string) => void;
  onLayerRename: (layerId: string, newName: string) => void;
  onLayerDelete: (layerId: string) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  canvases,
  layers,
  currentLayerId,
  onCanvasSelect,
  onCanvasCreate,
  onCanvasRename,
  onCanvasDelete,
  onLayerSelect,
  onLayerCreate,
  onLayerToggleVisibility,
  onLayerRename,
  onLayerDelete,
}) => {
  const [canvasMenuOpen, setCanvasMenuOpen] = useState<string | null>(null);
  const [layerMenuOpen, setLayerMenuOpen] = useState<string | null>(null);
  const [editingCanvas, setEditingCanvas] = useState<string | null>(null);
  const [editingLayer, setEditingLayer] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleCanvasRename = (canvasId: string) => {
    if (editValue.trim()) {
      onCanvasRename(canvasId, editValue.trim());
    }
    setEditingCanvas(null);
    setEditValue('');
  };

  const handleLayerRename = (layerId: string) => {
    if (editValue.trim()) {
      onLayerRename(layerId, editValue.trim());
    }
    setEditingLayer(null);
    setEditValue('');
  };

  // 关闭所有菜单
  const closeAllMenus = () => {
    setCanvasMenuOpen(null);
    setLayerMenuOpen(null);
  };

  // 全局点击关闭菜单（处理点击侧边栏外部的情况）
  React.useEffect(() => {
    const handleClickOutside = () => {
      closeAllMenus();
    };
    
    if (canvasMenuOpen || layerMenuOpen) {
      // 延迟注册，避免打开菜单的点击事件立即触发关闭
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [canvasMenuOpen, layerMenuOpen]);

  return (
    <>
      <FloatingSidebarShell
        side="right"
        isOpen={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          closeAllMenus();
        }}
      >
        <div className="min-h-0 flex-1 grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-h-0 p-4">
            <RightSidebarSection
              title="CANVASES"
              kind="canvas"
              items={canvases}
              activeId={null}
              editingId={editingCanvas}
              editValue={editValue}
              emptyLabel="No canvases yet"
              onCreate={onCanvasCreate}
              onSelect={onCanvasSelect}
              onMenuToggle={(id) => setCanvasMenuOpen(canvasMenuOpen === id ? null : id)}
              onEditValueChange={setEditValue}
              onRenameCommit={handleCanvasRename}
              onRenameCancel={() => {
                setEditingCanvas(null);
                setEditValue('');
              }}
            />
          </div>

          <div className="min-h-0 border-t border-[#E0D8F0] p-4">
            <RightSidebarSection
              title="LAYERS"
              kind="layer"
              items={layers}
              activeId={currentLayerId}
              editingId={editingLayer}
              editValue={editValue}
              emptyLabel="No layers yet"
              onCreate={onLayerCreate}
              onSelect={onLayerSelect}
              onMenuToggle={(id) => setLayerMenuOpen(layerMenuOpen === id ? null : id)}
              onEditValueChange={setEditValue}
              onRenameCommit={handleLayerRename}
              onRenameCancel={() => {
                setEditingLayer(null);
                setEditValue('');
              }}
              onVisibilityToggle={onLayerToggleVisibility}
            />
          </div>
        </div>
      </FloatingSidebarShell>

      <RightSidebarActionMenu
        itemId={canvasMenuOpen}
        itemKind="canvas"
        label={canvases.find((canvas) => canvas.id === canvasMenuOpen)?.name || ''}
        onRename={() => {
          const canvas = canvases.find((item) => item.id === canvasMenuOpen);
          if (!canvas) return;
          setEditingCanvas(canvas.id);
          setEditValue(canvas.name);
          setCanvasMenuOpen(null);
        }}
        onDelete={() => {
          if (!canvasMenuOpen) return;
          onCanvasDelete(canvasMenuOpen);
          setCanvasMenuOpen(null);
        }}
      />

      <RightSidebarActionMenu
        itemId={layerMenuOpen}
        itemKind="layer"
        label={layers.find((layer) => layer.id === layerMenuOpen)?.name || ''}
        onRename={() => {
          const layer = layers.find((item) => item.id === layerMenuOpen);
          if (!layer) return;
          setEditingLayer(layer.id);
          setEditValue(layer.name);
          setLayerMenuOpen(null);
        }}
        onDelete={() => {
          if (!layerMenuOpen) return;
          onLayerDelete(layerMenuOpen);
          setLayerMenuOpen(null);
        }}
      />
    </>
  );
};
