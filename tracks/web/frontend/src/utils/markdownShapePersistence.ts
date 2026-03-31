import type { ShapeData } from '../types';
import { renderMarkdownToPNG } from './markdownRenderer';

type MarkdownShape = Extract<ShapeData, { type: 'markdown' }>;
type MarkdownShapeData = MarkdownShape['data'];

export const MIN_MARKDOWN_WIDTH = 96;
export const MIN_MARKDOWN_HEIGHT = 40;

const roundDimension = (value: number, min: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.round(value));
};

export const getMarkdownLayoutWidth = (
  data: Pick<MarkdownShapeData, 'width' | 'scaleX'>
) => roundDimension(data.width * (data.scaleX ?? 1), MIN_MARKDOWN_WIDTH);

export const getMarkdownLayoutHeight = (
  data: Pick<MarkdownShapeData, 'height' | 'scaleY'>
) => roundDimension(data.height * (data.scaleY ?? 1), MIN_MARKDOWN_HEIGHT);

export const normalizeMarkdownShapeData = (
  data: MarkdownShapeData,
  overrides: Partial<MarkdownShapeData> = {}
): MarkdownShapeData => ({
  x: overrides.x ?? data.x,
  y: overrides.y ?? data.y,
  width: overrides.width ?? getMarkdownLayoutWidth(data),
  height: overrides.height ?? getMarkdownLayoutHeight(data),
  content: overrides.content ?? data.content,
  renderedImage: overrides.renderedImage ?? data.renderedImage,
  rotation: overrides.rotation ?? 0,
  scaleX: overrides.scaleX ?? 1,
  scaleY: overrides.scaleY ?? 1,
});

export const renderMarkdownShapeData = async (
  content: string,
  layout: { x: number; y: number; width: number; height?: number }
): Promise<MarkdownShapeData> => {
  const targetWidth = roundDimension(layout.width, MIN_MARKDOWN_WIDTH);
  const targetHeight =
    typeof layout.height === 'number'
      ? roundDimension(layout.height, MIN_MARKDOWN_HEIGHT)
      : undefined;
  const { dataURL, height } = await renderMarkdownToPNG(content, {
    maxWidth: targetWidth,
    maxHeight: targetHeight,
  });

  return {
    x: layout.x,
    y: layout.y,
    width: targetWidth,
    height: targetHeight ?? roundDimension(height, MIN_MARKDOWN_HEIGHT),
    content,
    renderedImage: dataURL,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  };
};

export const rerenderMarkdownShape = async (
  shape: MarkdownShape,
  layout: Partial<Pick<MarkdownShapeData, 'x' | 'y' | 'width' | 'height'>> = {}
): Promise<MarkdownShapeData> => {
  const normalized = normalizeMarkdownShapeData(shape.data, layout);
  return renderMarkdownShapeData(normalized.content, {
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
  });
};
