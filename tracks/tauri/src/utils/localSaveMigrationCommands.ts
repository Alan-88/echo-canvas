import { invoke } from '@tauri-apps/api/core';
import type { RoomSnapshotFile } from '../types';
import {
  decodeWhiteboardSnapshot,
  WHITEBOARD_FILE_EXTENSION,
} from './roomWhiteboardCodec';
import type { LocalSaveLoaded } from './localSaveCommands';

const WHITEBOARD_FILE_SUFFIX = `.${WHITEBOARD_FILE_EXTENSION}`;

const stripWhiteboardSuffix = (filename: string) =>
  filename.toLowerCase().endsWith(WHITEBOARD_FILE_SUFFIX)
    ? filename.slice(0, -WHITEBOARD_FILE_SUFFIX.length)
    : filename;

export const parseWhiteboardMigrationFile = async (
  file: File
): Promise<{ snapshot: RoomSnapshotFile; sourceName: string }> => {
  if (!file.name.toLowerCase().endsWith(WHITEBOARD_FILE_SUFFIX)) {
    throw new Error('当前仅支持导入 .whiteboard 文件');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const snapshot = decodeWhiteboardSnapshot(bytes);
  const sourceName = stripWhiteboardSuffix(file.name).trim();

  return {
    snapshot,
    sourceName,
  };
};

export const importLocalSaveSnapshot = (
  snapshot: RoomSnapshotFile,
  sourceName?: string
) =>
  invoke<LocalSaveLoaded>('import_local_save_snapshot', {
    snapshot,
    sourceName: sourceName?.trim() || null,
  });
