import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  validateRoomSnapshot,
  sanitizeRoomSnapshot,
  type ValidationResult,
} from '../utils/roomValidator';
import { buildApiUrl } from '../utils/runtimeNetwork';
import { decodeWhiteboardSnapshot } from '../utils/roomWhiteboardCodec';
import type { RoomSnapshotFile } from '../types';

const generateRoomId = () =>
  Math.floor(10000000 + Math.random() * 90000000).toString();

export const useRemoteLobbyLogic = () => {
  const navigate = useNavigate();

  const [serverMode, setServerMode] = useState<'unknown' | 'multi' | 'single'>('unknown');
  const [singleRoomId, setSingleRoomId] = useState<string | null>(null);

  const [roomId, setRoomId] = useState('');
  const [checkStatus, setCheckStatus] = useState<'idle' | 'checking' | 'exists' | 'new'>('idle');

  useEffect(() => {
    fetch(buildApiUrl('/api/server/info'))
      .then(res => res.json())
      .then(data => {
        if (data.singlePlayerRoomId) {
          setServerMode('single');
          setSingleRoomId(data.singlePlayerRoomId);
          setRoomId(data.singlePlayerRoomId);
        } else {
          setServerMode('multi');
        }
      })
      .catch(() => setServerMode('multi'));
  }, []);

  const [importState, setImportState] = useState({
    file: null as File | null,
    snapshot: null as RoomSnapshotFile | null,
    validation: null as ValidationResult | null,
    error: '',
    isImporting: false,
  });
  const [restoreState, setRestoreState] = useState({
    token: '',
    error: '',
    isRestoring: false,
  });

  const checkRoom = async (id: string) => {
    if (!id || (serverMode === 'multi' && !/^\d{8}$/.test(id))) {
      setCheckStatus('idle');
      return;
    }

    setCheckStatus('checking');
    try {
      const response = await fetch(buildApiUrl(`/api/room/${id}/exists`), {
        cache: 'no-store',
      });
      const data = (await response.json()) as { exists: boolean };
      setCheckStatus(data.exists ? 'exists' : 'new');
    } catch (error) {
      console.error('检查远端房间失败:', error);
      setCheckStatus('idle');
    }
  };

  const updateRoomId = (value: string) => {
    setRoomId(value);
    void checkRoom(value);
  };

  const enterRoom = () => {
    if (roomId.trim()) navigate(`/room/${roomId}`);
  };

  const selectImportFile = async (file: File) => {
    if (!file) return;

    setImportState((previous) => ({
      ...previous,
      file,
      snapshot: null,
      validation: null,
      error: '',
    }));

    if (file.size > 10 * 1024 * 1024) {
      setImportState((previous) => ({ ...previous, error: '文件过大 (>10MB)' }));
      return;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const snapshot = decodeWhiteboardSnapshot(bytes);
      const validation = validateRoomSnapshot(snapshot, file.size);
      setImportState((previous) => ({
        ...previous,
        snapshot,
        validation,
        error: validation.valid ? '' : `验证失败: ${validation.errors[0]}`,
      }));
    } catch (error) {
      console.error('远端导入文件解析失败:', error);
      setImportState((previous) => ({ ...previous, error: '白板文件解析失败' }));
    }
  };

  const executeImport = async (targetRoomId: string) => {
    const { file, snapshot, validation } = importState;
    if (!file || !snapshot || !validation?.valid) return;

    setImportState((previous) => ({ ...previous, isImporting: true, error: '' }));

    try {
      const fileData = validation.valid
        ? snapshot
        : sanitizeRoomSnapshot(snapshot).sanitized;

      const response = await fetch(buildApiUrl('/api/room/import-snapshot'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: fileData, newRoomId: targetRoomId }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || '远端导入失败');

      navigate(`/room/${targetRoomId}`);
    } catch (error) {
      console.error('远端导入失败:', error);
      setImportState((previous) => ({
        ...previous,
        error: (error as Error).message,
        isImporting: false,
      }));
      return;
    }

    setImportState((previous) => ({ ...previous, isImporting: false }));
  };

  const executeRestore = async (targetRoomId: string) => {
    if (!restoreState.token) return;

    setRestoreState((previous) => ({ ...previous, isRestoring: true, error: '' }));

    try {
      const response = await fetch(buildApiUrl('/api/room/restore'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restoreToken: restoreState.token,
          newRoomId: targetRoomId,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; room_id?: string }
        | null;

      if (!response.ok) {
        setRestoreState((previous) => ({
          ...previous,
          error: data?.error || '恢复失败',
          isRestoring: false,
        }));
        return;
      }

      navigate(`/room/${data?.room_id || targetRoomId}`);
    } catch (error) {
      console.error('远端恢复失败:', error);
      setRestoreState((previous) => ({
        ...previous,
        error: '网络错误',
        isRestoring: false,
      }));
      return;
    }

    setRestoreState((previous) => ({ ...previous, isRestoring: false }));
  };

  return {
    generateId: generateRoomId,
    serverMode,
    singleRoomId,
    create: {
      roomId,
      setRoomId: updateRoomId,
      checkStatus,
      join: enterRoom,
    },
    import: {
      state: importState,
      selectFile: selectImportFile,
      execute: executeImport,
    },
    restore: {
      state: restoreState,
      setToken: (token: string) =>
        setRestoreState((previous) => ({ ...previous, token })),
      execute: executeRestore,
    },
  };
};
