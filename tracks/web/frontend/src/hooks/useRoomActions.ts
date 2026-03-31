/**
 * 房间操作 Hook
 * 处理保存、导出、离开、关闭等房间级操作
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWhiteboardStore } from '../store/useWhiteboardStore';
import { exportCanvasAsPNG, exportRoomAsWhiteboard } from '../utils/fileExporter';
import { copyToClipboard } from '../utils/clipboard';
import { useCloseRoomState, type CloseResultState } from './useCloseRoomState';

export type TokenState = 'unsaved' | 'syncing' | 'synced';

export interface RoomActionsState {
  // Token 状态
  tokenState: TokenState;
  setTokenState: (state: TokenState) => void;
  savedToken: string;
  setSavedToken: (token: string) => void;
  
  // 复制状态
  roomIdCopied: boolean;
  tokenCopied: boolean;
  
  // 对话框状态
  showCloseDialog: boolean;
  setShowCloseDialog: (show: boolean) => void;
  closeResult: CloseResultState | null;
  closeResultCopied: boolean;
  
  // 操作方法
  handleSaveRoom: () => void;
  handleExportWhiteboard: () => void;
  handleExportPNG: (stageRef: any, layerIds: string[], allVisibleShapes: Record<string, any[]>) => Promise<void>;
  handleCopyRoomId: (roomId: string) => Promise<void>;
  handleCopyToken: () => Promise<void>;
  handleLeaveRoom: () => void;
  handleCloseRoom: () => void;
  confirmClose: (action: 'cancel' | 'save' | 'direct') => void;
  dismissCloseResult: () => void;
  handleCopyCloseResultToken: () => Promise<void>;
}

export const useRoomActions = (
  roomId: string,
  send: (msg: any) => void
): RoomActionsState => {
  const navigate = useNavigate();
  const canvases = useWhiteboardStore((s) => s.canvases);
  const canvasIds = useWhiteboardStore((s) => s.canvasIds);

  const [tokenState, setTokenState] = useState<TokenState>('unsaved');
  const [savedToken, setSavedToken] = useState('');
  const [roomIdCopied, setRoomIdCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const closeRoomState = useCloseRoomState(() => navigate('/'));

  // 监听保存成功事件
  useEffect(() => {
    const handleRoomSaved = (e: any) => {
      const data = e.detail;
      setSavedToken(data.restoreToken);
      setTokenState('synced');
      closeRoomState.rememberPendingToken(data.restoreToken);
    };

    const handleRoomTokenRestored = (e: any) => {
      const data = e.detail;
      console.log('[useRoomActions] Token restored from server:', data.restoreToken);
      setSavedToken(data.restoreToken);
      setTokenState('synced');
    };

    const handleRoomClosed = (e: any) => {
      const data = e.detail;
      const closeMode = closeRoomState.consumeRoomClosed(data.message);
      if (closeMode === 'saved') return;

      alert(`🚪 ${data.message}`);
      setTimeout(() => navigate('/'), 1000);
    };

    const handleServerError = (e: any) => {
      const data = e.detail;
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
  }, [closeRoomState, navigate, tokenState]);

  const handleSaveRoom = () => {
    setTokenState('syncing');
    send({ event: 'saveRoom', data: { forceNewVersion: false } });
  };

  const handleExportWhiteboard = () => {
    try {
      exportRoomAsWhiteboard(roomId, canvases, canvasIds);
      alert('✅ 白板存档已导出到本地文件！');
    } catch (error) {
      alert('❌ 导出失败: ' + (error as Error).message);
    }
  };

  const handleExportPNG = async (
    stageRef: any,
    layerIds: string[],
    allVisibleShapes: Record<string, any[]>
  ) => {
    try {
      await exportCanvasAsPNG(stageRef, layerIds, allVisibleShapes);
    } catch (error) {
      console.error('导出PNG失败:', error);
      alert('❌ 导出失败');
    }
  };

  const handleCopyRoomId = async (roomId: string) => {
    const success = await copyToClipboard(roomId);
    if (success) {
      setRoomIdCopied(true);
      setTimeout(() => setRoomIdCopied(false), 2000);
    } else {
      alert('自动复制失败，请手动选中并复制房间号');
    }
  };

  const handleCopyToken = async () => {
    const success = await copyToClipboard(savedToken);
    if (success) {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } else {
      alert('自动复制失败，请手动选中并复制Token');
    }
  };

  const handleLeaveRoom = () => {
    navigate('/');
  };

  const handleCloseRoom = () => {
    closeRoomState.setShowCloseDialog(true);
  };

  const confirmClose = (action: 'cancel' | 'save' | 'direct') => {
    if (action === 'cancel') {
      closeRoomState.setShowCloseDialog(false);
      return;
    }

    closeRoomState.beginClose(action);
    const saveBeforeClose = action === 'save';
    if (saveBeforeClose) {
      setTokenState('syncing');
    }
    send({ event: 'closeRoom', data: { saveBeforeClose } });
  };

  return {
    tokenState,
    setTokenState,
    savedToken,
    setSavedToken,
    roomIdCopied,
    tokenCopied,
    showCloseDialog: closeRoomState.showCloseDialog,
    setShowCloseDialog: closeRoomState.setShowCloseDialog,
    closeResult: closeRoomState.closeResult,
    closeResultCopied: closeRoomState.closeResultCopied,
    handleSaveRoom,
    handleExportWhiteboard,
    handleExportPNG,
    handleCopyRoomId,
    handleCopyToken,
    handleLeaveRoom,
    handleCloseRoom,
    confirmClose,
    dismissCloseResult: closeRoomState.dismissCloseResult,
    handleCopyCloseResultToken: closeRoomState.handleCopyCloseResultToken,
  };
};
