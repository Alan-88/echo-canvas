import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'whiteboard-stylus-mode-enabled';
const STYLUS_MODE_EVENT = 'whiteboardStylusModeChanged';

const readStoredStylusMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === 'true';
};

const broadcastStylusMode = (enabled: boolean) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<boolean>(STYLUS_MODE_EVENT, { detail: enabled }));
};

export const useStylusMode = () => {
  const [stylusModeEnabled, setStylusModeState] = useState<boolean>(readStoredStylusMode);

  useEffect(() => {
    const handleStylusModeChanged = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      if (typeof detail === 'boolean') {
        setStylusModeState(detail);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setStylusModeState(readStoredStylusMode());
    };

    window.addEventListener(STYLUS_MODE_EVENT, handleStylusModeChanged as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(STYLUS_MODE_EVENT, handleStylusModeChanged as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setStylusModeEnabled = useCallback((enabled: boolean) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    }
    setStylusModeState(enabled);
    broadcastStylusMode(enabled);
  }, []);

  return {
    stylusModeEnabled,
    setStylusModeEnabled,
  };
};
