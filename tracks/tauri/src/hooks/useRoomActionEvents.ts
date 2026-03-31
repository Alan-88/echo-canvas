import { useEffect } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { TokenState } from './useRoomActions';
import { getActiveRemoteRuntimeConfig } from '../utils/remoteSessionConfig';

interface CloseRoomStateLike {
  rememberPendingToken: (token: string) => void;
  consumeRoomClosed: (message: string) => 'saved' | 'default';
  resetPendingClose: () => void;
}

interface UseRoomActionEventsOptions {
  isLocalSession: boolean;
  tokenState: TokenState;
  setSavedToken: (token: string) => void;
  setTokenState: (state: TokenState) => void;
  closeRoomState: CloseRoomStateLike;
  navigate: NavigateFunction;
}

export const useRoomActionEvents = ({
  isLocalSession,
  tokenState,
  setSavedToken,
  setTokenState,
  closeRoomState,
  navigate,
}: UseRoomActionEventsOptions) => {
  useEffect(() => {
    const handleRoomSaved = (e: Event) => {
      const data = (e as CustomEvent<{ restoreToken: string }>).detail;
      setSavedToken(isLocalSession ? '' : data.restoreToken);
      setTokenState('synced');
      if (!isLocalSession && data.restoreToken) {
        closeRoomState.rememberPendingToken(data.restoreToken);
      }
    };

    const handleRoomTokenRestored = (e: Event) => {
      if (isLocalSession) return;
      const data = (e as CustomEvent<{ restoreToken: string }>).detail;
      console.log('[useRoomActions] Token restored from server:', data.restoreToken);
      setSavedToken(data.restoreToken);
      setTokenState('synced');
    };

    const handleRoomClosed = (e: Event) => {
      const data = (e as CustomEvent<{ message: string }>).detail;
      const closeMode = closeRoomState.consumeRoomClosed(data.message);
      if (closeMode === 'saved') return;

      alert(`🚪 ${data.message}`);
      setTimeout(() => navigate(getActiveRemoteRuntimeConfig() ? '/remote-lobby' : '/'), 1000);
    };

    const handleServerError = (e: Event) => {
      const data = (e as CustomEvent<{ message: string }>).detail;
      alert(`❌ 错误: ${data.message}`);
      if (tokenState === 'syncing') setTokenState('unsaved');
      closeRoomState.resetPendingClose();
    };

    window.addEventListener('roomSaved', handleRoomSaved);
    window.addEventListener('roomTokenRestored', handleRoomTokenRestored);
    window.addEventListener('roomClosed', handleRoomClosed);
    window.addEventListener('serverError', handleServerError);

    return () => {
      window.removeEventListener('roomSaved', handleRoomSaved);
      window.removeEventListener('roomTokenRestored', handleRoomTokenRestored);
      window.removeEventListener('roomClosed', handleRoomClosed);
      window.removeEventListener('serverError', handleServerError);
    };
  }, [
    closeRoomState,
    isLocalSession,
    navigate,
    setSavedToken,
    setTokenState,
    tokenState,
  ]);
};
