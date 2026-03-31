import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWhiteboardStore } from '../store/useWhiteboardStore';
import { exportCanvasAsPNG, exportRoomAsWhiteboard } from '../utils/fileExporter';
import { copyToClipboard } from '../utils/clipboard';
import { useCloseRoomState, type CloseResultState } from './useCloseRoomState';
import { useLocalRoomPersistence } from './useLocalRoomPersistence';
import { useRoomActionEvents } from './useRoomActionEvents';
import { isLocalRoomSession } from '../utils/roomSessionMode';
import { useLocalWhiteboardFiles } from './useLocalWhiteboardFiles';
import { getActiveRemoteRuntimeConfig } from '../utils/remoteSessionConfig';

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
  handleOpenWhiteboardFile: () => Promise<void>;
  handleSaveWhiteboardAs: () => Promise<void>;
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
  const isLocalSession = isLocalRoomSession(roomId);
  const canvases = useWhiteboardStore((s) => s.canvases);
  const canvasIds = useWhiteboardStore((s) => s.canvasIds);

  const [tokenState, setTokenState] = useState<TokenState>(
    isLocalSession ? 'synced' : 'unsaved'
  );
  const [savedToken, setSavedToken] = useState('');
  const [roomIdCopied, setRoomIdCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const closeRoomState = useCloseRoomState(() => {
    navigate(getActiveRemoteRuntimeConfig() ? '/remote-lobby' : '/');
  });
  const localWhiteboardFiles = useLocalWhiteboardFiles({
    roomId,
    canvases,
    canvasIds,
  });
  const localPersistence = useLocalRoomPersistence({
    enabled: isLocalSession,
    roomId,
    tokenState,
    setTokenState,
    navigate,
    persistLocalSnapshot: localWhiteboardFiles.persistLocalSnapshot,
    persistLocalSnapshotBeacon: localWhiteboardFiles.persistLocalSnapshotBeacon,
  });

  useRoomActionEvents({
    isLocalSession,
    tokenState,
    setSavedToken,
    setTokenState,
    closeRoomState,
    navigate,
  });

  const handleSaveRoom = () => {
    if (localPersistence.handleLocalSaveRoom()) {
      return;
    }

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

  const handleSaveWhiteboardAs = async () => {
    if (!isLocalSession) return;

    try {
      await localWhiteboardFiles.handleSaveWhiteboardAs();
    } catch (error) {
      console.error('另存为失败:', error);
      alert('❌ 另存为失败: ' + (error as Error).message);
    }
  };

  const handleOpenWhiteboardFile = async () => {
    if (!isLocalSession) return;

    try {
      const didLoad = await localWhiteboardFiles.handleOpenWhiteboardFile();
      if (!didLoad) return;

      window.location.reload();
    } catch (error) {
      console.error('打开白板文件失败:', error);
      alert('❌ 打开失败: ' + (error as Error).message);
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
    if (localPersistence.handleLocalLeaveRoom()) {
      return;
    }

    navigate(getActiveRemoteRuntimeConfig() ? '/remote-lobby' : '/');
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
    handleOpenWhiteboardFile,
    handleSaveWhiteboardAs,
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
