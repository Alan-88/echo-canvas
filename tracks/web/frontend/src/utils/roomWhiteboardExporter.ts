import {
  buildRoomSnapshotFromStore,
  encodeWhiteboardSnapshot,
  WHITEBOARD_FILE_EXTENSION,
} from './roomWhiteboardCodec';

const downloadWhiteboardFile = (bytes: Uint8Array, fileName: string) => {
  const copiedBytes = new Uint8Array(bytes.byteLength);
  copiedBytes.set(bytes);
  const blob = new Blob([copiedBytes.buffer], {
    type: 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  URL.revokeObjectURL(url);
};

export const exportRoomAsWhiteboard = (
  roomId: string,
  canvases: Record<string, any>,
  canvasIds: string[]
): void => {
  try {
    const snapshot = buildRoomSnapshotFromStore(roomId, canvases, canvasIds);
    const bytes = encodeWhiteboardSnapshot(snapshot, 'json');
    downloadWhiteboardFile(
      bytes,
      `room_${roomId}_${Date.now()}.${WHITEBOARD_FILE_EXTENSION}`
    );
  } catch (error) {
    console.error('导出白板失败:', error);
    throw new Error('导出失败: ' + (error as Error).message);
  }
};
