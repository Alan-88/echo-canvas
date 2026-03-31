import { decode, encode } from '@msgpack/msgpack';
import type { CanvasView, RoomSnapshotFile } from '../types';

export const WHITEBOARD_FILE_EXTENSION = 'whiteboard';
const WHITEBOARD_FILE_MAGIC = 'whiteboard-file';
const WHITEBOARD_FILE_VERSION = 1;

type EmbeddedSnapshotFormat = 'json' | 'msgpack';

type WhiteboardFileEnvelope = {
  magic: string;
  version: number;
  snapshotFormat: EmbeddedSnapshotFormat;
  payload: Uint8Array;
};

export const buildRoomSnapshotFromStore = (
  roomId: string,
  canvases: Record<string, any>,
  canvasIds: string[]
): RoomSnapshotFile => ({
  originalRoomId: roomId,
  savedAt: new Date().toISOString(),
  canvases: Object.fromEntries(
    canvasIds.map((canvasId) => {
      const canvas = canvases[canvasId];
      return [
        canvasId,
        {
          id: canvas.id,
          name: canvas.name,
          layers: Object.fromEntries(
            canvas.layerIds.map((layerId: string) => {
              const layer = canvas.layers[layerId];
              return [
                layerId,
                {
                  id: layer.id,
                  name: layer.name,
                  actions: layer.history,
                  pointer: layer.pointer,
                },
              ];
            })
          ),
        },
      ];
    })
  ),
  resources: {},
  metadata: {
    canvasCount: canvasIds.length,
    totalShapes: Object.values(canvases).reduce((sum, canvas: any) => {
      return (
        sum +
        Object.values(canvas.layers).reduce((layerSum, layer: any) => {
          return layerSum + layer.visibleShapes.length;
        }, 0)
      );
    }, 0),
    totalResources: 0,
    uniqueResources: 0,
    totalResourceBytes: 0,
    uniqueResourceBytes: 0,
    snapshotInlinePayloadsStripped: 0,
    snapshotInlineBytesStripped: 0,
    saveCount: 1,
  },
});

export const encodeWhiteboardSnapshot = (
  snapshot: RoomSnapshotFile,
  snapshotFormat: EmbeddedSnapshotFormat = 'json'
) => {
  const payload =
    snapshotFormat === 'json'
      ? new TextEncoder().encode(JSON.stringify(snapshot))
      : encode(snapshot);

  return encode({
    magic: WHITEBOARD_FILE_MAGIC,
    version: WHITEBOARD_FILE_VERSION,
    snapshotFormat,
    payload,
  } satisfies WhiteboardFileEnvelope);
};

export const decodeWhiteboardSnapshot = (bytes: Uint8Array): RoomSnapshotFile => {
  const envelope = decode(bytes) as WhiteboardFileEnvelope;

  if (envelope.magic !== WHITEBOARD_FILE_MAGIC) {
    throw new Error('Invalid .whiteboard file magic');
  }
  if (envelope.version !== WHITEBOARD_FILE_VERSION) {
    throw new Error(`Unsupported .whiteboard version: ${envelope.version}`);
  }

  if (envelope.snapshotFormat === 'json') {
    return JSON.parse(new TextDecoder().decode(envelope.payload)) as RoomSnapshotFile;
  }

  return decode(envelope.payload) as RoomSnapshotFile;
};

export const roomSnapshotToCanvasViews = (
  snapshot: RoomSnapshotFile
): { canvases: Record<string, CanvasView>; canvasIds: string[] } => {
  const canvasIds = Object.keys(snapshot.canvases);

  const canvases = Object.fromEntries(
    canvasIds.map((canvasId) => {
      const canvas = snapshot.canvases[canvasId];
      const layerIds = Object.keys(canvas.layers);
      return [
        canvasId,
        {
          id: canvas.id,
          name: canvas.name,
          layers: Object.fromEntries(
            layerIds.map((layerId) => {
              const layer = canvas.layers[layerId];
              return [
                layerId,
                {
                  id: layer.id,
                  name: layer.name,
                  history: layer.actions,
                  pointer: layer.pointer,
                },
              ];
            })
          ),
          layerIds,
        } satisfies CanvasView,
      ];
    })
  );

  return {
    canvases,
    canvasIds,
  };
};
