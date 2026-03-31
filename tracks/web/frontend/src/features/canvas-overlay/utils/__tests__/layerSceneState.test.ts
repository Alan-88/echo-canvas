import { describe, expect, it } from 'vitest';

import { buildLayerSceneShapes } from '../layerSceneState';
import type { ShapeData } from '../../../../types';

const line = (x: number): ShapeData => ({
  type: 'line',
  data: {
    points: [x, 0, x + 10, 10],
    stroke: '#111',
    stroke_width: 2,
  },
});

describe('buildLayerSceneShapes', () => {
  it('dims inactive layers while keeping active layer fully opaque', () => {
    const sceneShapes = buildLayerSceneShapes({
      allVisibleShapes: {
        'layer-a': [{ id: 'a', shape: line(0) }],
        'layer-b': [{ id: 'b', shape: line(40) }],
      },
      currentLayerId: 'layer-a',
      previewShapes: new Map(),
      selectedIds: [],
    });

    expect(sceneShapes).toEqual([
      { id: 'a', shape: line(0), opacity: 1 },
      { id: 'b', shape: line(40), opacity: 0.32 },
    ]);
  });
});
