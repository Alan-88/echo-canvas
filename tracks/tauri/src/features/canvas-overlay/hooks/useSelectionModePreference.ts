import { useCallback, useEffect, useState } from 'react';

export type SelectionMode = 'marquee' | 'lasso';

const STORAGE_KEY = 'whiteboard-selection-mode';
const MODE_CHANGE_EVENT = 'canvasOverlaySelectionModeChanged';

const isSelectionMode = (value: unknown): value is SelectionMode =>
  value === 'marquee' || value === 'lasso';

const readStoredSelectionMode = (): SelectionMode => {
  if (typeof window === 'undefined') return 'marquee';
  const value = window.localStorage.getItem(STORAGE_KEY);
  return isSelectionMode(value) ? value : 'marquee';
};

const broadcastSelectionMode = (mode: SelectionMode) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SelectionMode>(MODE_CHANGE_EVENT, { detail: mode }));
};

export const useSelectionModePreference = () => {
  const [selectionMode, setSelectionModeState] = useState<SelectionMode>(readStoredSelectionMode);

  useEffect(() => {
    const handleModeChanged = (event: Event) => {
      const detail = (event as CustomEvent<SelectionMode>).detail;
      if (isSelectionMode(detail)) {
        setSelectionModeState(detail);
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setSelectionModeState(readStoredSelectionMode());
    };

    window.addEventListener(MODE_CHANGE_EVENT, handleModeChanged as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(MODE_CHANGE_EVENT, handleModeChanged as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setSelectionMode = useCallback((mode: SelectionMode) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
    setSelectionModeState(mode);
    broadcastSelectionMode(mode);
  }, []);

  const resolveSelectionDragMode = useCallback(
    (shiftPressed: boolean): SelectionMode => {
      if (!shiftPressed) return selectionMode;
      return selectionMode === 'lasso' ? 'marquee' : 'lasso';
    },
    [selectionMode]
  );

  return {
    selectionMode,
    setSelectionMode,
    resolveSelectionDragMode,
  };
};

