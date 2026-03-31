import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  activateLocalSave,
  createLocalSave,
  listLocalSaves,
  loadSnapshotIntoLocalRoom,
  type LocalSaveSummary,
} from '../utils/localSaveCommands';
import {
  importLocalSaveSnapshot,
  parseWhiteboardMigrationFile,
} from '../utils/localSaveMigrationCommands';
import {
  clearActiveRemoteRuntimeConfig,
} from '../utils/remoteSessionConfig';
import { useLobbyMultiplayer } from './useLobbyMultiplayer';

export interface LocalSave {
  id: string;
  name: string;
  date: string;
  layers: number;
  size: string;
  thumbnailBg: string;
}

export function useLobbyLogic() {
  const navigate = useNavigate();

  // === 1. 单人游戏 (Local Saves) 逻辑 ===
  const [saves, setSaves] = useState<LocalSave[]>([]);
  const [selectedSaveId, setSelectedSaveId] = useState<string | null>(null);

  const loadLocalSaves = async () => {
    try {
      const nextSaves = (await listLocalSaves()) as LocalSaveSummary[];
      setSaves(nextSaves);
      setSelectedSaveId((current) => {
        if (current && nextSaves.some((save) => save.id === current)) return current;
        return nextSaves[0]?.id ?? null;
      });
    } catch (error) {
      console.error('读取本地存档失败:', error);
      setSaves([]);
      setSelectedSaveId(null);
    }
  };

  useEffect(() => {
    loadLocalSaves();
  }, []);

  const handleCreateNewSave = async () => {
    try {
      clearActiveRemoteRuntimeConfig();
      const { summary, snapshot } = await createLocalSave();
      await loadSnapshotIntoLocalRoom(snapshot);
      await loadLocalSaves();
      setSelectedSaveId(summary.id);
      navigate('/room/local-room');
    } catch (error) {
      console.error('创建本地存档失败:', error);
      alert(`创建本地存档失败: ${(error as Error).message}`);
    }
  };

  const handleEnterSave = async () => {
    if (!selectedSaveId) return;
    try {
      clearActiveRemoteRuntimeConfig();
      const { snapshot } = await activateLocalSave(selectedSaveId);
      await loadSnapshotIntoLocalRoom(snapshot);
      navigate('/room/local-room');
    } catch (error) {
      console.error('载入本地存档失败:', error);
      alert(`载入本地存档失败: ${(error as Error).message}`);
    }
  };

  // === 2. 多人联机 (Multiplayer) 逻辑 ===
  const multi = useLobbyMultiplayer(navigate);


  // === 3. 数据迁移 (Migrate) 逻辑 ===
  const [migrateState, setMigrateState] = useState({
    file: null as File | null,
    token: '',
    isMigrating: false,
    error: ''
  });

  const handleSelectMigrateFile = async (file: File) => {
     if (!file) return;

     try {
       await parseWhiteboardMigrationFile(file);
       setMigrateState(prev => ({ ...prev, file, error: '' }));
     } catch (error) {
       console.error('迁移文件校验失败:', error);
       const message = (error as Error).message;
       setMigrateState(prev => ({ ...prev, file: null, error: message }));
       alert(message);
     }
  };

  const executeMigrate = async () => {
    if (!migrateState.file && !migrateState.token.trim()) return;

    if (!migrateState.file) {
      const message = '当前版本迁移模式仅支持导入 .whiteboard 文件，Token 迁移稍后补齐';
      setMigrateState(prev => ({ ...prev, error: message }));
      alert(message);
      return;
    }

    setMigrateState(prev => ({ ...prev, isMigrating: true, error: '' }));

    try {
      clearActiveRemoteRuntimeConfig();

      const { snapshot, sourceName } = await parseWhiteboardMigrationFile(migrateState.file);
      const loaded = await importLocalSaveSnapshot(snapshot, sourceName);
      await loadSnapshotIntoLocalRoom(loaded.snapshot);
      await loadLocalSaves();
      setSelectedSaveId(loaded.summary.id);
      setMigrateState({
        file: null,
        token: '',
        isMigrating: false,
        error: '',
      });
      navigate('/room/local-room');
    } catch (error) {
      console.error('迁移本地存档失败:', error);
      const message = (error as Error).message;
      setMigrateState(prev => ({ ...prev, isMigrating: false, error: message }));
      alert(`迁移失败: ${message}`);
    }
  };

  return {
    single: {
      saves,
      selectedSaveId,
      setSelectedSaveId,
      createSave: handleCreateNewSave,
      enterSave: handleEnterSave
    },
    multi,
    migrate: {
      state: migrateState,
      setToken: (t: string) => setMigrateState(prev => ({ ...prev, token: t })),
      selectFile: handleSelectMigrateFile,
      execute: executeMigrate
    }
  };
}
