import { describe, expect, it } from 'vitest';

import type { ClientMessage, ShapeData } from '../../types';
import {
  encodeClientFrame,
  resolveClientFrameCodecModeWithEnv,
} from '../wsMessageCodec';

const sampleLine = (points: number): ShapeData => ({
  type: 'line',
  data: {
    points: Array.from({ length: points * 2 }, (_, index) =>
      index % 2 === 0 ? index * 1.5 : (index % 17) * 2
    ),
    stroke: '#111111',
    stroke_width: 4,
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  },
});

const sampleDrawMessage = (points: number): ClientMessage => ({
  event: 'layerOp',
  data: {
    canvasId: '00000000-0000-0000-0000-000000000000',
    layerId: '00000000-0000-0000-0000-000000000001',
    action: {
      type: 'draw',
      payload: {
        id: '00000000-0000-0000-0000-000000000002',
        shape: sampleLine(points),
      },
    },
  },
});

const sampleBatchUpdateMessage = (items: number, points: number): ClientMessage => ({
  event: 'layerOp',
  data: {
    canvasId: '00000000-0000-0000-0000-000000000003',
    layerId: '00000000-0000-0000-0000-000000000004',
    action: {
      type: 'batchUpdate',
      payload: {
        updates: Array.from({ length: items }, (_, index) => ({
          id: `00000000-0000-0000-0000-${String(index + 10).padStart(12, '0')}`,
          oldShape: sampleLine(points),
          newShape: sampleLine(points + 4),
        })),
      },
    },
  },
});

describe('encodeClientFrame', () => {
  it('produces smaller msgpack payloads for line-heavy draw messages', () => {
    const message = sampleDrawMessage(256);
    const jsonPayload = encodeClientFrame(message, 'json');
    const msgpackPayload = encodeClientFrame(message, 'msgpack');

    expect(typeof jsonPayload).toBe('string');
    expect(msgpackPayload).toBeInstanceOf(Uint8Array);
    expect((msgpackPayload as Uint8Array).byteLength).toBeLessThan(
      (jsonPayload as string).length
    );
  });

  it('produces smaller msgpack payloads for batch update messages', () => {
    const message = sampleBatchUpdateMessage(8, 64);
    const jsonPayload = encodeClientFrame(message, 'json');
    const msgpackPayload = encodeClientFrame(message, 'msgpack');

    expect((msgpackPayload as Uint8Array).byteLength).toBeLessThan(
      (jsonPayload as string).length
    );
  });

  it('defaults layerOp sends to msgpack while keeping control messages json', () => {
    expect(
      resolveClientFrameCodecModeWithEnv(
        { event: 'join' },
        { defaultCodec: 'json' }
      )
    ).toBe('json');

    expect(
      resolveClientFrameCodecModeWithEnv(sampleDrawMessage(64), {
        defaultCodec: 'json',
      })
    ).toBe('msgpack');
  });

  it('allows overriding layerOp codec back to json', () => {
    expect(
      resolveClientFrameCodecModeWithEnv(sampleDrawMessage(64), {
        defaultCodec: 'json',
        layerOpCodec: 'json',
      })
    ).toBe('json');
  });
});
