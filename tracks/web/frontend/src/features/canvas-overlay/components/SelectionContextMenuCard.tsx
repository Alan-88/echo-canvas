import React from 'react';
import type { SelectionMenuAction } from '../utils/selectionMenuEvents';

interface SelectionContextMenuState {
  x: number;
  y: number;
  kind: 'empty' | 'selection';
}

interface SelectionContextMenuCardProps {
  menu: SelectionContextMenuState;
  canCreateLatexTextBox: boolean;
  onAction: (action: SelectionMenuAction) => void;
}

export const SelectionContextMenuCard: React.FC<SelectionContextMenuCardProps> = ({
  menu,
  canCreateLatexTextBox,
  onAction,
}) => {
  const isSelectionMenu = menu.kind === 'selection';

  return (
    <div
      className="absolute z-[120] min-w-[180px] rounded-xl border border-white/60 bg-white/95 p-1.5 shadow-2xl backdrop-blur"
      style={{
        left: menu.x,
        top: menu.y,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {isSelectionMenu && (
        <button
          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-input"
          onClick={() => onAction('copy')}
        >
          Copy Selection
        </button>
      )}
      {!isSelectionMenu && (
        <button
          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-input"
          onClick={() => onAction('paste')}
        >
          Paste
        </button>
      )}
      {isSelectionMenu && (
        <>
          <div className="my-1 h-px bg-black/10" />
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-input"
            onClick={() => onAction('delete')}
          >
            Delete Selection
          </button>
          <div className="my-1 h-px bg-black/10" />
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-input"
            onClick={() => onAction('export-png')}
          >
            Export Selection as PNG
          </button>
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-input"
            onClick={() => onAction('export-json')}
          >
            Export Selection as JSON
          </button>
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-input disabled:cursor-not-allowed disabled:text-ink/40 disabled:hover:bg-transparent"
            onClick={() => onAction('export-latex')}
            disabled={!canCreateLatexTextBox}
          >
            Create LaTeX Text Box
          </button>
        </>
      )}
    </div>
  );
};
