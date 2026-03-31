import { useEffect } from 'react';
import {
  exportSelectionAsPng,
  exportSelectionPayloadAsJson,
} from '../features/canvas-overlay/utils/selectionExport';
import {
  CANVAS_SELECTION_MENU_ACTION_EVENT,
  type SelectionMenuAction,
} from '../features/canvas-overlay/utils/selectionMenuEvents';
import type { SelectionDomainState } from './useSelectionDomainState';

interface UseSelectionMenuActionsOptions {
  isExperimental: boolean;
  editingMarkdownOpen: boolean;
  selectionDomain: Pick<SelectionDomainState, 'hasSelection' | 'payload' | 'selectedShapes'>;
  deleteSelection: () => void;
  copySelection: () => Promise<void>;
  pasteFromClipboard: () => Promise<void>;
  createLatexTextBoxFromSelection: () => Promise<void>;
}

export const useSelectionMenuActions = ({
  isExperimental,
  editingMarkdownOpen,
  selectionDomain,
  deleteSelection,
  copySelection,
  pasteFromClipboard,
  createLatexTextBoxFromSelection,
}: UseSelectionMenuActionsOptions) => {
  useEffect(() => {
    const handleSelectionMenuAction = (event: Event) => {
      if (!isExperimental || editingMarkdownOpen) return;

      const customEvent = event as CustomEvent<{ action?: SelectionMenuAction }>;
      const action = customEvent.detail?.action;
      if (!action) return;

      if (action === 'copy') {
        if (!selectionDomain.hasSelection) return;
        void copySelection();
        return;
      }

      if (action === 'paste') {
        void pasteFromClipboard();
        return;
      }

      if (action === 'delete') {
        deleteSelection();
        return;
      }

      if (action === 'export-png') {
        if (!selectionDomain.hasSelection) return;
        void exportSelectionAsPng({ shapes: selectionDomain.selectedShapes });
        return;
      }

      if (action === 'export-json') {
        const payload = selectionDomain.payload;
        if (!payload) return;
        exportSelectionPayloadAsJson(payload);
        return;
      }

      if (action === 'export-latex') {
        void createLatexTextBoxFromSelection();
      }
    };

    window.addEventListener(
      CANVAS_SELECTION_MENU_ACTION_EVENT,
      handleSelectionMenuAction as EventListener
    );
    return () => {
      window.removeEventListener(
        CANVAS_SELECTION_MENU_ACTION_EVENT,
        handleSelectionMenuAction as EventListener
      );
    };
  }, [
    copySelection,
    createLatexTextBoxFromSelection,
    deleteSelection,
    editingMarkdownOpen,
    isExperimental,
    pasteFromClipboard,
    selectionDomain.hasSelection,
    selectionDomain.payload,
    selectionDomain.selectedShapes,
  ]);
};
