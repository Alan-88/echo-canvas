import { describe, expect, it } from 'vitest';

import { serializeSelectionClipboardPayload } from '../selectionClipboard';

describe('serializeSelectionClipboardPayload', () => {
  it('strips markdown renderedImage from clipboard text payload', () => {
    const serialized = serializeSelectionClipboardPayload({
      kind: 'whiteboard-selection',
      version: 1,
      anchor: { x: 10, y: 20 },
      shapes: [
        {
          type: 'markdown',
          data: {
            x: 10,
            y: 20,
            width: 200,
            height: 80,
            content: 'hello',
            renderedImage: 'data:image/png;base64,very-large',
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
        },
      ],
    });

    expect(serialized).not.toContain('very-large');
    expect(serialized).toContain('"renderedImage":""');
    expect(serialized).toContain('"content":"hello"');
  });
});
