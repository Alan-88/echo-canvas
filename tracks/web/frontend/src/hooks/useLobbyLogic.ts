import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { validateRoomSnapshot, sanitizeRoomSnapshot, type ValidationResult } from '../utils/roomValidator';
import { buildApiUrl } from '../utils/runtimeNetwork';
import { decodeWhiteboardSnapshot } from '../utils/roomWhiteboardCodec';
import type { RoomSnapshotFile } from '../types';

// 工具函数
const generateRoomId = () => Math.floor(10000000 + Math.random() * 90000000).toString();

export function useLobbyLogic() {
  const navigate = useNavigate();

  const [serverMode, setServerMode] = useState<'unknown' | 'multi' | 'single'>('unknown');
  const [singleRoomId, setSingleRoomId] = useState<string | null>(null);

  // === 1. 创建/加入房间逻辑 ===
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

  const checkRoom = async (id: string) => {
    if (!id || (serverMode === 'multi' && !/^\d{8}$/.test(id))) {
      setCheckStatus('idle');
      return;
    }
    setCheckStatus('checking');
    try {
      const res = await fetch(buildApiUrl(`/api/room/${id}/exists`));
      const data = await res.json();
      setCheckStatus(data.exists ? 'exists' : 'new');
    } catch (e) {
      console.error(e);
      setCheckStatus('idle');
    }
  };

  const updateRoomId = (val: string) => {
    setRoomId(val);
    checkRoom(val);
  };

  const handleJoin = () => {
    if (roomId.trim()) navigate(`/room/${roomId}`);
  };

  // === 2. 导入文件逻辑 ===
  const [importState, setImportState] = useState({
    file: null as File | null,
    snapshot: null as RoomSnapshotFile | null,
    validation: null as ValidationResult | null,
    error: '',
    isImporting: false,
    showWarning: false
  });

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    // 重置状态
    setImportState(prev => ({ ...prev, file, snapshot: null, error: '', validation: null }));

    if (file.size > 10 * 1024 * 1024) {
      setImportState(prev => ({ ...prev, error: '文件过大 (>10MB)' }));
      return;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const data = decodeWhiteboardSnapshot(bytes);
      const result = validateRoomSnapshot(data, file.size);
      
      setImportState(prev => ({ 
        ...prev, 
        snapshot: data,
        validation: result, 
        error: result.valid ? '' : `验证失败: ${result.errors[0]}` 
      }));
    } catch (e) {
      setImportState(prev => ({ ...prev, error: '白板文件解析失败' }));
    }
  };

  const executeImport = async (targetRoomId: string) => {
    const { file, snapshot, validation } = importState;
    if (!file || !snapshot || !validation?.valid) return;

    setImportState(prev => ({ ...prev, isImporting: true }));
    
    try {
      let fileData = snapshot;
      
      // 自动清理
      if (!validation.valid) {
         fileData = sanitizeRoomSnapshot(fileData).sanitized;
      }

      // API 调用
      const res = await fetch(buildApiUrl('/api/room/import-snapshot'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: fileData, newRoomId: targetRoomId }),
      });

      if (!res.ok) throw new Error((await res.json()).error);
      
      navigate(`/room/${targetRoomId}`);
    } catch (e: any) {
      setImportState(prev => ({ ...prev, error: e.message, isImporting: false }));
    }
  };

  // === 3. Token 恢复逻辑 ===
  const [restoreState, setRestoreState] = useState({
    token: '',
    error: '',
    isRestoring: false
  });

  const handleRestore = async (targetRoomId: string) => {
    if (!restoreState.token) return;
    setRestoreState(prev => ({ ...prev, isRestoring: true, error: '' }));

    try {
      const res = await fetch(buildApiUrl('/api/room/restore'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restoreToken: restoreState.token, newRoomId: targetRoomId }),
      });
      
      const data = await res.json();
      if (res.ok) {
        navigate(`/room/${data.room_id || targetRoomId}`);
      } else {
        setRestoreState(prev => ({ ...prev, error: data.error || '恢复失败' }));
      }
    } catch (e) {
      setRestoreState(prev => ({ ...prev, error: '网络错误' }));
    } finally {
      setRestoreState(prev => ({ ...prev, isRestoring: false }));
    }
  };

  return {
    // Generics
    generateId: generateRoomId,
    serverMode,
    singleRoomId,
    
    // Create Mode
    create: { roomId, setRoomId: updateRoomId, checkStatus, join: handleJoin },
    
    // Import Mode
    import: { 
      state: importState, 
      selectFile: handleFileSelect, 
      execute: executeImport,
      dismissWarning: () => setImportState(prev => ({ ...prev, showWarning: false })) 
    },
    
    // Restore Mode
    restore: { 
      state: restoreState, 
      setToken: (t: string) => setRestoreState(prev => ({ ...prev, token: t })), 
      execute: handleRestore 
    }
  };
}
