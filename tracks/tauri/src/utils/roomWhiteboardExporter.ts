import {
  buildRoomSnapshotFromStore,
  encodeWhiteboardSnapshot,
  WHITEBOARD_FILE_EXTENSION,
} from './roomWhiteboardCodec';

const downloadBinaryFile = (bytes: Uint8Array, fileName: string, mimeType: string) => {
  const blobPart = new Uint8Array(bytes) as unknown as BlobPart;
  const blob = new Blob([blobPart], { type: mimeType });
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

    downloadBinaryFile(
      encodeWhiteboardSnapshot(snapshot, 'json'),
      `room_${roomId}_${Date.now()}.${WHITEBOARD_FILE_EXTENSION}`,
      'application/x-whiteboard'
    );
  } catch (error) {
    console.error('导出 .whiteboard 失败:', error);
    throw new Error('导出失败: ' + (error as Error).message);
  }
};
