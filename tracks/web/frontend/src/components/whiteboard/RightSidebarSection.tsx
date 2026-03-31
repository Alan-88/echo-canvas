import React from 'react';
import { Plus, MoreHorizontal, Eye, EyeOff } from 'lucide-react';

interface SidebarItem {
  id: string;
  name: string;
}

interface CanvasItem extends SidebarItem {
  isActive: boolean;
}

interface LayerItem extends SidebarItem {
  visible: boolean;
}

interface RightSidebarSectionProps {
  title: string;
  kind: 'canvas' | 'layer';
  items: CanvasItem[] | LayerItem[];
  activeId?: string | null;
  editingId: string | null;
  editValue: string;
  emptyLabel: string;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onMenuToggle: (id: string) => void;
  onEditValueChange: (value: string) => void;
  onRenameCommit: (id: string) => void;
  onRenameCancel: () => void;
  onVisibilityToggle?: (id: string) => void;
}

const isLayerItem = (item: CanvasItem | LayerItem): item is LayerItem => 'visible' in item;

export const RightSidebarSection: React.FC<RightSidebarSectionProps> = ({
  title,
  kind,
  items,
  activeId,
  editingId,
  editValue,
  emptyLabel,
  onCreate,
  onSelect,
  onMenuToggle,
  onEditValueChange,
  onRenameCommit,
  onRenameCancel,
  onVisibilityToggle,
}) => (
  <section className="min-h-0 flex flex-col">
    <div className="flex justify-between items-center mb-4 px-2">
      <span className="text-xs font-black text-lavender uppercase tracking-widest">{title}</span>
      <button
        onClick={onCreate}
        className="w-6 h-6 rounded-lg bg-input hover:bg-ink hover:text-white text-ink flex items-center justify-center transition-colors"
        title={`Create ${kind === 'canvas' ? 'Canvas' : 'Layer'}`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>

    <div className="min-h-0 overflow-y-auto scrollbar-hide space-y-2 px-1">
      {items.length === 0 ? (
        <div className="text-center py-8 text-lavender text-sm">{emptyLabel}</div>
      ) : (
        items.map((item) => {
          const isCanvas = kind === 'canvas';
          const isActive = isCanvas ? (item as CanvasItem).isActive : item.id === activeId;

          return (
            <div
              key={item.id}
              data-sidebar-item-kind={kind}
              data-sidebar-item-id={item.id}
              onClick={() => onSelect(item.id)}
              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer group transition-all ${
                isCanvas
                  ? isActive
                    ? 'bg-input border-transparent shadow-sm'
                    : 'bg-white border-transparent hover:bg-input hover:shadow-sm'
                  : isActive
                    ? 'bg-white border-[#E0D8F0] shadow-sm'
                    : 'bg-white border-transparent hover:border-[#E0D8F0] hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {isCanvas ? (
                  <div className={`w-1.5 h-8 rounded-full ${isActive ? 'bg-ink' : 'bg-[#E0D8F0]'}`} />
                ) : isLayerItem(item) && onVisibilityToggle ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onVisibilityToggle(item.id);
                    }}
                    className="text-ink hover:text-purple-600 transition-colors shrink-0"
                    title={item.visible ? 'Hide Layer' : 'Show Layer'}
                  >
                    {item.visible ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4 opacity-50" />
                    )}
                  </button>
                ) : null}

                {editingId === item.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={editValue}
                    onChange={(event) => onEditValueChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        onRenameCommit(item.id);
                      } else if (event.key === 'Escape') {
                        onRenameCancel();
                      }
                    }}
                    onBlur={() => onRenameCommit(item.id)}
                    onClick={(event) => event.stopPropagation()}
                    className="min-w-0 text-sm font-bold text-ink bg-white border border-lavender rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-lavender"
                  />
                ) : (
                  <span className="min-w-0 truncate text-sm font-bold text-ink">{item.name}</span>
                )}
              </div>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onMenuToggle(item.id);
                }}
                className={`${isCanvas ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} shrink-0 transition-opacity text-lavender hover:text-ink`}
                title={`${kind === 'canvas' ? 'Canvas' : 'Layer'} Menu`}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          );
        })
      )}
    </div>
  </section>
);
