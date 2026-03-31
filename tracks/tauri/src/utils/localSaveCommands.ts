import { invoke } from '@tauri-apps/api/core';
import { buildApiUrl } from './runtimeNetwork';
import type { RoomSnapshotFile } from '../types';

export interface LocalSaveSummary {
  id: string;
  name: string;
  date: string;
  layers: number;
  size: string;
  thumbnailBg: string;
}

export interface LocalSaveLoaded {
  summary: LocalSaveSummary;
  snapshot: RoomSnapshotFile;
}

export const listLocalSaves = () => invoke<LocalSaveSummary[]>('list_local_saves');

export const createLocalSave = () => invoke<LocalSaveLoaded>('create_local_save');

export const activateLocalSave = (saveId: string) =>
  invoke<LocalSaveLoaded>('activate_local_save', { saveId });

export const loadSnapshotIntoLocalRoom = async (snapshot: RoomSnapshotFile) => {
  const response = await fetch(buildApiUrl('/api/local/load-snapshot'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ snapshot }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || '载入本地存档失败');
  }
};
