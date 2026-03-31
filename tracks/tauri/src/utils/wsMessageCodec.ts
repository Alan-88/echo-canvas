import { decode, encode } from '@msgpack/msgpack';

import type { ClientMessage, ServerMessage } from '../types';

export type WsMessageCodecMode = 'json' | 'msgpack';

const normalizeCodecMode = (raw: unknown): WsMessageCodecMode => {
  const value = String(raw ?? 'json').trim().toLowerCase();
  if (value === 'msgpack' || value === 'messagepack' || value === 'mpk') {
    return 'msgpack';
  }
  return 'json';
};

export const getWsMessageCodecMode = (): WsMessageCodecMode =>
  normalizeCodecMode(import.meta.env.VITE_WS_MESSAGE_CODEC);

type ClientCodecEnv = {
  defaultCodec?: unknown;
  layerOpCodec?: unknown;
};

export const resolveClientFrameCodecModeWithEnv = (
  message: ClientMessage,
  env: ClientCodecEnv
): WsMessageCodecMode => {
  const defaultMode = normalizeCodecMode(env.defaultCodec);
  const layerOpMode =
    env.layerOpCodec == null || String(env.layerOpCodec).trim() === ''
      ? 'msgpack'
      : normalizeCodecMode(env.layerOpCodec);

  return message.event === 'layerOp' ? layerOpMode : defaultMode;
};

export const resolveClientFrameCodecMode = (
  message: ClientMessage
): WsMessageCodecMode =>
  resolveClientFrameCodecModeWithEnv(message, {
    defaultCodec: import.meta.env.VITE_WS_MESSAGE_CODEC,
    layerOpCodec: import.meta.env.VITE_WS_LAYER_OP_CODEC,
  });

export const encodeClientFrame = (
  message: ClientMessage,
  mode: WsMessageCodecMode
): string | Uint8Array =>
  mode === 'msgpack' ? encode(message) : JSON.stringify(message);

const decodeBinaryFrame = (bytes: Uint8Array): ServerMessage =>
  decode(bytes) as ServerMessage;

export const decodeServerFrame = async (
  data: string | ArrayBuffer | Blob | ArrayBufferView
): Promise<ServerMessage> => {
  if (typeof data === 'string') {
    return JSON.parse(data) as ServerMessage;
  }

  if (data instanceof Blob) {
    const buffer = await data.arrayBuffer();
    return decodeBinaryFrame(new Uint8Array(buffer));
  }

  if (data instanceof ArrayBuffer) {
    return decodeBinaryFrame(new Uint8Array(data));
  }

  if (ArrayBuffer.isView(data)) {
    return decodeBinaryFrame(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    );
  }

  throw new Error('Unsupported WebSocket frame data type');
};
