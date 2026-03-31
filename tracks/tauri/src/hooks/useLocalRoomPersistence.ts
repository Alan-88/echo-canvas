import { useEffect, useRef } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { TokenState } from './useRoomActions';

interface UseLocalRoomPersistenceOptions {
  enabled: boolean;
  roomId: string;
  tokenState: TokenState;
  setTokenState: (state: TokenState) => void;
  navigate: NavigateFunction;
  persistLocalSnapshot: () => Promise<boolean>;
  persistLocalSnapshotBeacon: () => boolean;
}

export const useLocalRoomPersistence = ({
  enabled,
  roomId,
  tokenState,
  setTokenState,
  navigate,
  persistLocalSnapshot,
  persistLocalSnapshotBeacon,
}: UseLocalRoomPersistenceOptions) => {
  const tokenStateRef = useRef<TokenState>(enabled ? 'synced' : 'unsaved');
  const saveInFlightRef = useRef(false);
  const persistSnapshotRef = useRef(persistLocalSnapshot);
  const persistSnapshotBeaconRef = useRef(persistLocalSnapshotBeacon);

  useEffect(() => {
    tokenStateRef.current = tokenState;
  }, [tokenState]);

  useEffect(() => {
    persistSnapshotRef.current = persistLocalSnapshot;
    persistSnapshotBeaconRef.current = persistLocalSnapshotBeacon;
  }, [persistLocalSnapshot, persistLocalSnapshotBeacon]);

  useEffect(() => {
    if (!enabled) return;
    setTokenState('synced');
  }, [enabled, roomId, setTokenState]);

  const saveLocalSnapshot = async () => {
    if (saveInFlightRef.current) return false;

    saveInFlightRef.current = true;
    setTokenState('syncing');

    try {
      await persistSnapshotRef.current();
      setTokenState('synced');
      return true;
    } catch (error) {
      setTokenState('unsaved');
      throw error;
    } finally {
      saveInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!enabled) return;

    const tryAutosave = async () => {
      if (tokenStateRef.current !== 'unsaved') return;

      try {
        await saveLocalSnapshot();
      } catch (error) {
        console.error('本地自动保存失败:', error);
      }
    };

    const intervalId = window.setInterval(() => {
      void tryAutosave();
    }, 5 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void tryAutosave();
      }
    };

    const handleBeforeUnload = () => {
      if (tokenStateRef.current !== 'unsaved') return;
      persistSnapshotBeaconRef.current();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);

  const handleLocalLeaveRoom = () => {
    if (!enabled) return false;

    if (tokenStateRef.current === 'synced') {
      navigate('/');
      return true;
    }

    void saveLocalSnapshot()
      .then(() => navigate('/'))
      .catch((error) => {
        console.error('离开前本地保存失败:', error);
        alert(`❌ 离开前保存失败: ${(error as Error).message}`);
      });
    return true;
  };

  const handleLocalSaveRoom = () => {
    if (!enabled) return false;

    void saveLocalSnapshot().catch((error) => {
      console.error('本地快照保存失败:', error);
      alert(`❌ 保存失败: ${(error as Error).message}`);
    });
    return true;
  };

  return {
    handleLocalLeaveRoom,
    handleLocalSaveRoom,
  };
};
