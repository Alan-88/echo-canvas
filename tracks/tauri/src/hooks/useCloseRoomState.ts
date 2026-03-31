import { useCallback, useRef, useState } from 'react';
import { copyToClipboard } from '../utils/clipboard';

type PendingCloseAction = 'save' | 'direct' | null;

export interface CloseResultState {
  message: string;
  restoreToken: string;
}

export const useCloseRoomState = (onExit: () => void) => {
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeResult, setCloseResult] = useState<CloseResultState | null>(null);
  const [closeResultCopied, setCloseResultCopied] = useState(false);

  const pendingCloseActionRef = useRef<PendingCloseAction>(null);
  const pendingCloseTokenRef = useRef('');

  const beginClose = useCallback((action: Exclude<PendingCloseAction, null>) => {
    pendingCloseActionRef.current = action;
    pendingCloseTokenRef.current = '';
    setShowCloseDialog(false);
    setCloseResultCopied(false);
  }, []);

  const rememberPendingToken = useCallback((restoreToken: string) => {
    if (pendingCloseActionRef.current === 'save') {
      pendingCloseTokenRef.current = restoreToken;
    }
  }, []);

  const consumeRoomClosed = useCallback((message: string) => {
    const shouldShowSavedResult =
      pendingCloseActionRef.current === 'save' && pendingCloseTokenRef.current.length > 0;

    pendingCloseActionRef.current = null;

    if (shouldShowSavedResult) {
      setCloseResult({
        message,
        restoreToken: pendingCloseTokenRef.current,
      });
      pendingCloseTokenRef.current = '';
      setCloseResultCopied(false);
      return 'saved';
    }

    pendingCloseTokenRef.current = '';
    return 'default';
  }, []);

  const resetPendingClose = useCallback(() => {
    pendingCloseActionRef.current = null;
    pendingCloseTokenRef.current = '';
    setShowCloseDialog(false);
  }, []);

  const dismissCloseResult = useCallback(() => {
    setCloseResult(null);
    setCloseResultCopied(false);
    onExit();
  }, [onExit]);

  const handleCopyCloseResultToken = useCallback(async () => {
    if (!closeResult?.restoreToken) return;

    const success = await copyToClipboard(closeResult.restoreToken);
    if (success) {
      setCloseResultCopied(true);
      setTimeout(() => setCloseResultCopied(false), 2000);
    } else {
      alert('自动复制失败，请手动选中并复制Token');
    }
  }, [closeResult]);

  return {
    showCloseDialog,
    setShowCloseDialog,
    closeResult,
    closeResultCopied,
    beginClose,
    rememberPendingToken,
    consumeRoomClosed,
    resetPendingClose,
    dismissCloseResult,
    handleCopyCloseResultToken,
  };
};
