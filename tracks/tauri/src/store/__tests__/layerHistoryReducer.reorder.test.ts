import { describe, expect, it } from 'vitest';

import { rebuildVisibleLayerShapes } from '../layerHistoryReducer';
import type { Action } from '../../types';

const IMAGE_SRC = 'data:image/png;base64,test';

const buildHistory = (): Action[] => [
  {
    type: 'draw',
    payload: {
      id: 'img-a',
      shape: {
        type: 'image',
        data: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          src: IMAGE_SRC,
        },
      },
    },
  },
  {
    type: 'draw',
    payload: {
      id: 'img-b',
      shape: {
        type: 'image',
        data: {
          x: 200,
          y: 0,
          width: 100,
          height: 100,
          src: IMAGE_SRC,
        },
      },
    },
  },
  {
    type: 'draw',
    payload: {
      id: 'line-a',
      shape: {
        type: 'line',
        data: {
          points: [0, 0, 10, 10],
          stroke: '#111',
          stroke_width: 2,
        },
      },
    },
  },
  {
    type: 'reorder',
    payload: {
      orderedIds: ['img-b', 'img-a', 'line-a'],
    },
  },
];

describe('rebuildVisibleLayerShapes reorder replay', () => {
  it('replays reorder action when pointer includes it', () => {
    const visible = rebuildVisibleLayerShapes(buildHistory(), 4);
    expect(visible.map((shape) => shape.id)).toEqual(['img-b', 'img-a', 'line-a']);
  });

  it('ignores reorder action when pointer is before it', () => {
    const visible = rebuildVisibleLayerShapes(buildHistory(), 3);
    expect(visible.map((shape) => shape.id)).toEqual(['img-a', 'img-b', 'line-a']);
  });
});
