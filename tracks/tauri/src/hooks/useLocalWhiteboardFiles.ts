import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { buildApiUrl } from '../utils/runtimeNetwork';
import {
  buildRoomSnapshotFromStore,
  decodeWhiteboardSnapshot,
  encodeWhiteboardSnapshot,
  WHITEBOARD_FILE_EXTENSION,
} from '../utils/roomWhiteboardCodec';

interface UseLocalWhiteboardFilesOptions {
  roomId: string;
  canvases: Record<string, any>;
  canvasIds: string[];
}

export const useLocalWhiteboardFiles = ({
  roomId,
  canvases,
  canvasIds,
}: UseLocalWhiteboardFilesOptions) => {
  const buildSnapshot = () => buildRoomSnapshotFromStore(roomId, canvases, canvasIds);

  const describeError = (error: unknown) => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object') {
      const message = Reflect.get(error, 'message');
      if (typeof message === 'string' && message.length > 0) return message;
      try {
        return JSON.stringify(error);
      } catch {
        return 'unknown error';
      }
    }
    return 'unknown error';
  };

  const postSnapshotToLocalRoom = async (snapshot: ReturnType<typeof buildSnapshot>) => {
    const response = await fetch(buildApiUrl('/api/local/load-snapshot'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snapshot }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || '载入失败');
    }
  };

  const handleSaveWhiteboardAs = async () => {
    try {
      const path = await save({
        filters: [{ name: 'Whiteboard File', extensions: [WHITEBOARD_FILE_EXTENSION] }],
        defaultPath: `whiteboard-${Date.now()}.${WHITEBOARD_FILE_EXTENSION}`,
      });
      if (!path) return false;

      const snapshot = buildSnapshot();
      const bytes = encodeWhiteboardSnapshot(snapshot, 'json');
      await writeFile(path, bytes);
      return true;
    } catch (error) {
      throw new Error(describeError(error));
    }
  };

  const handleOpenWhiteboardFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Whiteboard File', extensions: [WHITEBOARD_FILE_EXTENSION] }],
      });

      if (!selected || Array.isArray(selected)) return false;

      const bytes = await readFile(selected);
      const snapshot = decodeWhiteboardSnapshot(bytes);
      await postSnapshotToLocalRoom(snapshot);

      return true;
    } catch (error) {
      throw new Error(describeError(error));
    }
  };

  const persistLocalSnapshot = async () => {
    try {
      await postSnapshotToLocalRoom(buildSnapshot());
      return true;
    } catch (error) {
      throw new Error(describeError(error));
    }
  };

  const persistLocalSnapshotBeacon = () => {
    try {
      const payload = JSON.stringify({ snapshot: buildSnapshot() });
      return navigator.sendBeacon(
        buildApiUrl('/api/local/load-snapshot'),
        new Blob([payload], { type: 'application/json' })
      );
    } catch (error) {
      console.error('beforeunload 本地快照保存失败:', error);
      return false;
    }
  };

  return {
    handleSaveWhiteboardAs,
    handleOpenWhiteboardFile,
    persistLocalSnapshot,
    persistLocalSnapshotBeacon,
  };
};
