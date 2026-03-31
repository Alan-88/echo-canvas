import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';

interface RightSidebarActionMenuProps {
  itemId: string | null;
  itemKind: 'canvas' | 'layer';
  label: string;
  onRename: () => void;
  onDelete: () => void;
}

export const RightSidebarActionMenu: React.FC<RightSidebarActionMenuProps> = ({
  itemId,
  itemKind,
  label,
  onRename,
  onDelete,
}) => {
  if (!itemId) return null;

  const itemElement = document.querySelector(
    `[data-sidebar-item-kind="${itemKind}"][data-sidebar-item-id="${itemId}"]`
  ) as HTMLElement | null;
  if (!itemElement) return null;

  const rect = itemElement.getBoundingClientRect();

  return (
    <div
      className="fixed w-40 bg-white rounded-xl shadow-xl border border-[#E0D8F0] py-1 z-100"
      style={{
        left: `${Math.max(12, rect.right - 160)}px`,
        top: `${rect.bottom + 4}px`,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        onClick={(event) => {
          event.stopPropagation();
          onRename();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-input transition-colors"
      >
        <Edit2 className="w-4 h-4" />
        Rename
      </button>
      <button
        onClick={(event) => {
          event.stopPropagation();
          if (confirm(`Delete ${itemKind} "${label}"?`)) {
            onDelete();
          }
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </div>
  );
};
