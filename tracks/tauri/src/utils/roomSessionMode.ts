export const LOCAL_ROOM_ID = 'local-room';

export type RoomSessionMode = 'local' | 'shared';
export type SaveState = 'unsaved' | 'syncing' | 'synced';

export const isTauriRuntime = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const getRoomSessionMode = (roomId: string): RoomSessionMode =>
  isTauriRuntime() && roomId === LOCAL_ROOM_ID ? 'local' : 'shared';

export const isLocalRoomSession = (roomId: string) =>
  getRoomSessionMode(roomId) === 'local';

export const getSaveStateLabel = (mode: RoomSessionMode, state: SaveState) => {
  if (mode === 'local') {
    if (state === 'synced') return 'Saved';
    if (state === 'syncing') return 'Saving';
    return 'Unsaved';
  }

  if (state === 'synced') return 'Synced';
  if (state === 'syncing') return 'Syncing';
  return 'Unsaved';
};

export const getPrimarySaveActionLabel = (mode: RoomSessionMode, state: SaveState) => {
  if (mode === 'local') {
    if (state === 'synced') return 'Saved Locally';
    if (state === 'syncing') return 'Saving...';
    return 'Save Snapshot';
  }

  if (state === 'synced') return 'Synced';
  if (state === 'syncing') return 'Syncing...';
  return 'Sync to Server';
};
