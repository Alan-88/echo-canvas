import { describe, expect, it } from 'vitest';

import { buildAutoSelectionReorderAction } from '../selectionAutoReorder';
import { orderShapesForSelectionDisplay } from '../selectionOrder';
import type { ShapeData } from '../../../../types';

interface ShapeWithId {
  id: string;
  shape: ShapeData;
}

const image = (x: number): ShapeData => ({
  type: 'image',
  data: {
    x,
    y: 0,
    width: 100,
    height: 100,
    src: 'data:image/png;base64,test',
  },
});

const markdown = (x: number): ShapeData => ({
  type: 'markdown',
  data: {
    x,
    y: 0,
    width: 220,
    height: 120,
    content: '## demo',
    renderedImage: 'data:image/png;base64,test',
  },
});

const line = (): ShapeData => ({
  type: 'line',
  data: {
    points: [0, 0, 10, 10],
    stroke: '#111',
    stroke_width: 2,
  },
});

describe('buildAutoSelectionReorderAction', () => {
  it('moves selected shapes to front inside each visual layer group', () => {
    const layerShapes: ShapeWithId[] = [
      { id: 'img-a', shape: image(0) },
      { id: 'img-b', shape: image(200) },
      { id: 'md-a', shape: markdown(400) },
      { id: 'line-a', shape: line() },
      { id: 'line-b', shape: line() },
    ];

    const action = buildAutoSelectionReorderAction(layerShapes, ['line-a', 'img-a']);

    expect(action).toEqual({
      type: 'reorder',
      payload: {
        orderedIds: ['img-b', 'img-a', 'md-a', 'line-b', 'line-a'],
      },
    });
  });

  it('returns null when no selected ids can change order', () => {
    const layerShapes: ShapeWithId[] = [
      { id: 'img-a', shape: image(0) },
      { id: 'line-a', shape: line() },
    ];

    expect(buildAutoSelectionReorderAction(layerShapes, [])).toBeNull();
    expect(buildAutoSelectionReorderAction(layerShapes, ['missing-id'])).toBeNull();
  });
});

describe('orderShapesForSelectionDisplay', () => {
  it('renders selected items on top inside the same visual layer', () => {
    const shapes: ShapeWithId[] = [
      { id: 'img-a', shape: image(0) },
      { id: 'img-b', shape: image(100) },
      { id: 'line-a', shape: line() },
      { id: 'line-b', shape: line() },
    ];

    const ordered = orderShapesForSelectionDisplay(shapes, ['img-a', 'line-a']);

    expect(ordered.map((shape) => shape.id)).toEqual([
      'img-b',
      'img-a',
      'line-b',
      'line-a',
    ]);
  });
});
