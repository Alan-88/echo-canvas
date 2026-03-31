import { useEffect } from 'react';
import type { SelectionDomainState } from './useSelectionDomainState';

const isEditableEventTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};

interface UseSelectionClipboardHotkeysOptions {
  isExperimental: boolean;
  editingMarkdownOpen: boolean;
  selectionDomain: Pick<
    SelectionDomainState,
    'hasSelection' | 'payload' | 'markdownOnly' | 'plainText'
  >;
  deleteSelection: () => void;
  copySelection: () => Promise<void>;
}

export const useSelectionClipboardHotkeys = ({
  isExperimental,
  editingMarkdownOpen,
  selectionDomain,
  deleteSelection,
  copySelection,
}: UseSelectionClipboardHotkeysOptions) => {
  useEffect(() => {
    const handleSelectionHotkeys = (event: KeyboardEvent) => {
      if (!isExperimental || editingMarkdownOpen) return;
      if (isEditableEventTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const isMetaPressed = event.metaKey || event.ctrlKey;

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !isMetaPressed &&
        !event.altKey
      ) {
        if (!selectionDomain.hasSelection) return;
        event.preventDefault();
        deleteSelection();
        return;
      }

      if (!isMetaPressed || event.altKey) return;

      if (key === 'c' && !event.shiftKey) {
        if (!selectionDomain.hasSelection) return;
        event.preventDefault();
        void copySelection();
      }
    };

    document.addEventListener('keydown', handleSelectionHotkeys);
    return () => document.removeEventListener('keydown', handleSelectionHotkeys);
  }, [
    deleteSelection,
    copySelection,
    editingMarkdownOpen,
    isExperimental,
    selectionDomain.hasSelection,
    selectionDomain.payload,
    selectionDomain.markdownOnly,
    selectionDomain.plainText,
  ]);
};
