import { useEffect, useState } from 'react';
import { getActiveRemoteRuntimeConfig } from '../utils/remoteSessionConfig';
import type { RemoteMode } from '../components/remote-lobby/RemoteLobbySidebar';

type UseRemoteLobbyPageStateOptions = {
  currentRoomId: string;
  generateRoomId: () => string;
  setRoomId: (value: string) => void;
};

export function useRemoteLobbyPageState({
  currentRoomId,
  generateRoomId,
  setRoomId,
}: UseRemoteLobbyPageStateOptions) {
  const [activeMode, setActiveMode] = useState<RemoteMode>('create');
  const remoteConfig = getActiveRemoteRuntimeConfig();

  useEffect(() => {
    if (!currentRoomId) {
      setRoomId(generateRoomId());
    }
  }, [currentRoomId, generateRoomId, setRoomId]);

  return {
    activeMode,
    setActiveMode,
    remoteConfig,
    targetRoomId: currentRoomId || generateRoomId(),
  };
}
