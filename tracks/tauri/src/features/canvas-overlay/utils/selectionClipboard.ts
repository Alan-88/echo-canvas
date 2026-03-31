import type { ShapeData } from '../../../types';
import {
  getSelectionBounds,
  translateShape,
  type Point,
  type ShapeWithId,
} from './shapeGeometry';

const SELECTION_CLIPBOARD_PREFIX = 'whiteboard-selection/v1:';
export const SELECTION_CLIPBOARD_MIME = 'text/x-whiteboard-selection';

export interface SelectionClipboardPayload {
  kind: 'whiteboard-selection';
  version: 1;
  anchor: Point;
  shapes: ShapeData[];
}

const stripClipboardOnlyFields = (shape: ShapeData): ShapeData => {
  if (shape.type !== 'markdown') return shape;
  return {
    type: 'markdown',
    data: {
      ...shape.data,
      renderedImage: '',
    },
  };
};

interface PasteSelectionOptions {
  targetAnchor: Point;
  pasteCount: number;
  cascadeStep?: number;
}

const isValidPoint = (point: any): point is Point =>
  point &&
  typeof point === 'object' &&
  typeof point.x === 'number' &&
  typeof point.y === 'number';

const isValidPayload = (payload: any): payload is SelectionClipboardPayload =>
  payload &&
  payload.kind === 'whiteboard-selection' &&
  payload.version === 1 &&
  isValidPoint(payload.anchor) &&
  Array.isArray(payload.shapes) &&
  payload.shapes.length > 0;

export const buildSelectionClipboardPayload = (
  shapes: ShapeWithId[]
): SelectionClipboardPayload | null => {
  if (shapes.length === 0) return null;

  const bounds = getSelectionBounds(shapes);
  if (!bounds) return null;

  return {
    kind: 'whiteboard-selection',
    version: 1,
    anchor: { x: bounds.x, y: bounds.y },
    shapes: shapes.map((shape) => shape.shape),
  };
};

export const serializeSelectionClipboardPayload = (
  payload: SelectionClipboardPayload
): string =>
  `${SELECTION_CLIPBOARD_PREFIX}${JSON.stringify({
    ...payload,
    shapes: payload.shapes.map(stripClipboardOnlyFields),
  })}`;

export const parseSelectionClipboardPayload = (
  text: string | undefined
): SelectionClipboardPayload | null => {
  if (!text) return null;

  try {
    const normalized = text.startsWith(SELECTION_CLIPBOARD_PREFIX)
      ? text.slice(SELECTION_CLIPBOARD_PREFIX.length)
      : text;
    const parsed = JSON.parse(normalized) as SelectionClipboardPayload;
    return isValidPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const buildPastedShapesFromClipboardPayload = (
  payload: SelectionClipboardPayload,
  { targetAnchor, pasteCount, cascadeStep = 24 }: PasteSelectionOptions
): ShapeData[] => {
  const cascadeMultiplier = Math.max(1, pasteCount);
  const deltaX =
    targetAnchor.x - payload.anchor.x + cascadeStep * cascadeMultiplier;
  const deltaY =
    targetAnchor.y - payload.anchor.y + cascadeStep * cascadeMultiplier;

  return payload.shapes.map((shape) => translateShape(shape, deltaX, deltaY));
};

export const isMarkdownOnlySelection = (shapes: ShapeWithId[]) =>
  shapes.length > 0 && shapes.every((shape) => shape.shape.type === 'markdown');

export const buildPlainTextFromMarkdownSelection = (
  shapes: ShapeWithId[]
): string | null => {
  if (!isMarkdownOnlySelection(shapes)) return null;

  const ordered = shapes
    .filter((shape) => shape.shape.type === 'markdown')
    .sort((left, right) => {
      if (left.shape.type !== 'markdown' || right.shape.type !== 'markdown') return 0;
      const deltaY = left.shape.data.y - right.shape.data.y;
      if (Math.abs(deltaY) > 8) return deltaY;
      return left.shape.data.x - right.shape.data.x;
    });

  const merged = ordered
    .map((shape) => (shape.shape.type === 'markdown' ? shape.shape.data.content.trim() : ''))
    .filter((content) => content.length > 0)
    .join('\n\n');

  return merged.length > 0 ? merged : '';
};
