import type { ShapeData } from '../../../types';
import {
  getShapeBounds,
  getShapeWorldPoints,
  type Bounds,
  type ShapeWithId,
} from './shapeGeometry';
import type { SelectionClipboardPayload } from './selectionClipboard';
import {
  DEFAULT_EXPORT_EMPTY_SIZE,
  DEFAULT_EXPORT_MAX_PIXELS,
  DEFAULT_EXPORT_PIXEL_RATIO,
  resolveExportRasterScale,
  waitForExportAssets,
  type ExportEmptySize,
} from '../../../utils/exportPngPolicy';

interface ExportSelectionAsPngOptions {
  shapes: ShapeWithId[];
  fileNamePrefix?: string;
  padding?: number;
  pixelRatio?: number;
  maxPixels?: number;
  backgroundColor?: string | null;
  allowEmpty?: boolean;
  emptySize?: ExportEmptySize;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const getFileTimestamp = () =>
  new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }

    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

const drawLine = (
  context: CanvasRenderingContext2D,
  shape: Extract<ShapeData, { type: 'line' }>,
  offsetX: number,
  offsetY: number
) => {
  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0 } = shape.data;
  if (shape.data.points.length < 2) return;

  context.save();
  context.translate(x - offsetX, y - offsetY);
  context.rotate(toRadians(rotation));
  context.scale(scaleX, scaleY);
  context.beginPath();
  context.moveTo(shape.data.points[0], shape.data.points[1]);
  for (let index = 2; index < shape.data.points.length; index += 2) {
    context.lineTo(shape.data.points[index], shape.data.points[index + 1]);
  }
  context.strokeStyle = shape.data.stroke;
  context.lineWidth = shape.data.stroke_width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke();
  context.restore();
};

const drawRect = (
  context: CanvasRenderingContext2D,
  shape: Extract<ShapeData, { type: 'rect' }>,
  offsetX: number,
  offsetY: number
) => {
  const { x, y, width, height, scaleX = 1, scaleY = 1, rotation = 0 } = shape.data;

  context.save();
  context.translate(x - offsetX, y - offsetY);
  context.rotate(toRadians(rotation));
  context.scale(scaleX, scaleY);
  if (shape.data.fill) {
    context.fillStyle = shape.data.fill;
    context.fillRect(0, 0, width, height);
  }
  context.strokeStyle = shape.data.stroke;
  context.lineWidth = 2;
  context.strokeRect(0, 0, width, height);
  context.restore();
};

const drawImageLike = (
  context: CanvasRenderingContext2D,
  shape: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
  },
  image: HTMLImageElement,
  offsetX: number,
  offsetY: number
) => {
  const { x, y, width, height, scaleX = 1, scaleY = 1, rotation = 0 } = shape;

  context.save();
  context.translate(x - offsetX, y - offsetY);
  context.rotate(toRadians(rotation));
  context.scale(scaleX, scaleY);
  context.drawImage(image, 0, 0, width, height);
  context.restore();
};

const MARKDOWN_CARD_RADIUS = 12;

const buildRoundedRectPath = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number
) => {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

  context.beginPath();
  context.moveTo(safeRadius, 0);
  context.lineTo(width - safeRadius, 0);
  context.quadraticCurveTo(width, 0, width, safeRadius);
  context.lineTo(width, height - safeRadius);
  context.quadraticCurveTo(width, height, width - safeRadius, height);
  context.lineTo(safeRadius, height);
  context.quadraticCurveTo(0, height, 0, height - safeRadius);
  context.lineTo(0, safeRadius);
  context.quadraticCurveTo(0, 0, safeRadius, 0);
  context.closePath();
};

const drawMarkdownExportShape = (
  context: CanvasRenderingContext2D,
  shape: Extract<ShapeData, { type: 'markdown' }>,
  image: HTMLImageElement | undefined,
  offsetX: number,
  offsetY: number
) => {
  const { x, y, width, height, scaleX = 1, scaleY = 1, rotation = 0 } = shape.data;

  context.save();
  context.translate(x - offsetX, y - offsetY);
  context.rotate(toRadians(rotation));
  context.scale(scaleX, scaleY);
  buildRoundedRectPath(context, width, height, MARKDOWN_CARD_RADIUS);
  context.fillStyle = 'rgba(255, 255, 255, 0.82)';
  context.fill();
  context.strokeStyle = 'rgba(215, 207, 240, 0.92)';
  context.lineWidth = 1.5;
  context.stroke();
  if (image) {
    buildRoundedRectPath(context, width, height, MARKDOWN_CARD_RADIUS);
    context.clip();
    context.drawImage(image, 0, 0, width, height);
  }
  context.restore();
};

const getLineExportBounds = (
  shape: Extract<ShapeData, { type: 'line' }>
): Bounds => {
  const points = getShapeWorldPoints(shape);
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const strokePadding = Math.max(0, (shape.data.stroke_width ?? 1) / 2);

  return {
    x: minX - strokePadding,
    y: minY - strokePadding,
    width: Math.max(0, maxX - minX + strokePadding * 2),
    height: Math.max(0, maxY - minY + strokePadding * 2),
  };
};

const getShapeExportBounds = (shape: ShapeData): Bounds => {
  if (shape.type === 'line') {
    return getLineExportBounds(shape);
  }
  return getShapeBounds(shape);
};

const getShapesExportBounds = (shapes: ShapeWithId[]): Bounds | null => {
  if (shapes.length === 0) return null;

  const bounds = shapes.map((shapeWithId) => getShapeExportBounds(shapeWithId.shape));
  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
};

export const exportSelectionAsPng = async ({
  shapes,
  fileNamePrefix = 'whiteboard-selection',
  padding = 16,
  pixelRatio = DEFAULT_EXPORT_PIXEL_RATIO,
  maxPixels = DEFAULT_EXPORT_MAX_PIXELS,
  backgroundColor = null,
  allowEmpty = false,
  emptySize = DEFAULT_EXPORT_EMPTY_SIZE,
}: ExportSelectionAsPngOptions): Promise<boolean> => {
  const hasShapes = shapes.length > 0;
  const bounds = hasShapes ? getShapesExportBounds(shapes) : null;

  if (hasShapes && (!bounds || bounds.width <= 0 || bounds.height <= 0)) {
    if (!allowEmpty) return false;
  }

  if (!hasShapes && !allowEmpty) return false;

  const imageShapes = shapes.filter((shape) => shape.shape.type === 'image');
  const markdownShapes = shapes.filter((shape) => shape.shape.type === 'markdown');

  const imageSources = new Set<string>();
  imageShapes.forEach((shape) => {
    if (shape.shape.type === 'image') {
      imageSources.add(shape.shape.data.src);
    }
  });
  markdownShapes.forEach((shape) => {
    if (shape.shape.type === 'markdown') {
      imageSources.add(shape.shape.data.renderedImage);
    }
  });

  const loadedEntries = await Promise.all(
    Array.from(imageSources).map(async (src) => [src, await loadImage(src)] as const)
  );
  const imageCache = new Map<string, HTMLImageElement>();
  loadedEntries.forEach(([src, image]) => {
    if (image) {
      imageCache.set(src, image);
    }
  });
  if (imageSources.size > 0) {
    await waitForExportAssets();
  }

  const exportWidth =
    hasShapes && bounds ? Math.max(1, bounds.width + padding * 2) : Math.max(1, emptySize.width);
  const exportHeight =
    hasShapes && bounds ? Math.max(1, bounds.height + padding * 2) : Math.max(1, emptySize.height);
  const raster = resolveExportRasterScale({
    contentWidth: exportWidth,
    contentHeight: exportHeight,
    pixelRatio,
    maxPixels,
  });
  const canvas = document.createElement('canvas');
  canvas.width = raster.rasterWidth;
  canvas.height = raster.rasterHeight;

  const context = canvas.getContext('2d');
  if (!context) return false;

  context.setTransform(raster.pixelRatio, 0, 0, raster.pixelRatio, 0, 0);
  if (backgroundColor) {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, exportWidth, exportHeight);
  } else {
    context.clearRect(0, 0, exportWidth, exportHeight);
  }

  if (!hasShapes || !bounds) {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), 'image/png', 1);
    });
    if (!blob) return false;
    downloadBlob(blob, `${fileNamePrefix}-${getFileTimestamp()}.png`);
    return true;
  }

  const offsetX = bounds.x - padding;
  const offsetY = bounds.y - padding;

  shapes.forEach((shapeWithId) => {
    const shape = shapeWithId.shape;
    if (shape.type === 'line') {
      drawLine(context, shape, offsetX, offsetY);
      return;
    }

    if (shape.type === 'rect') {
      drawRect(context, shape, offsetX, offsetY);
      return;
    }

    if (shape.type === 'image') {
      const image = imageCache.get(shape.data.src);
      if (image) {
        drawImageLike(context, shape.data, image, offsetX, offsetY);
      }
      return;
    }

    if (shape.type === 'markdown') {
      const image = imageCache.get(shape.data.renderedImage);
      drawMarkdownExportShape(context, shape, image, offsetX, offsetY);
    }
  });

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/png', 1);
  });
  if (!blob) return false;

  downloadBlob(blob, `${fileNamePrefix}-${getFileTimestamp()}.png`);
  return true;
};

export const exportSelectionPayloadAsJson = (
  payload: SelectionClipboardPayload,
  fileNamePrefix = 'whiteboard-selection'
) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `${fileNamePrefix}-${getFileTimestamp()}.json`);
};

const collectMarkdownContents = (shapes: ShapeWithId[]): string[] =>
  shapes
    .filter((shape) => shape.shape.type === 'markdown')
    .map((shape) => (shape.shape.type === 'markdown' ? shape.shape.data.content.trim() : ''))
    .filter((content) => content.length > 0);

const collectLatexExpressions = (markdownContents: string[]) => {
  const expressions = new Set<string>();

  const pushExpression = (value: string | undefined) => {
    if (!value) return;
    const normalized = value.trim();
    if (!normalized) return;
    expressions.add(normalized);
  };

  markdownContents.forEach((content) => {
    for (const match of content.matchAll(/\$\$([\s\S]*?)\$\$/g)) {
      pushExpression(match[1]);
    }
    for (const match of content.matchAll(/\\\[([\s\S]*?)\\\]/g)) {
      pushExpression(match[1]);
    }
    for (const match of content.matchAll(/\\\(([\s\S]*?)\\\)/g)) {
      pushExpression(match[1]);
    }
    for (const match of content.matchAll(/(^|[^$])\$([^$\n]+?)\$(?!\$)/g)) {
      pushExpression(match[2]);
    }
  });

  return Array.from(expressions);
};

export interface SelectionLatexExtraction {
  markdownContents: string[];
  expressions: string[];
}

export const extractLatexFromSelection = (
  shapes: ShapeWithId[]
): SelectionLatexExtraction => {
  const markdownContents = collectMarkdownContents(shapes);
  return {
    markdownContents,
    expressions: collectLatexExpressions(markdownContents),
  };
};

export const buildMarkdownLatexContentFromSelection = (
  shapes: ShapeWithId[]
): string | null => {
  const hasOcrCandidateShape = shapes.some(
    (shape) => shape.shape.type === 'line' || shape.shape.type === 'rect'
  );
  if (!hasOcrCandidateShape) return null;

  // OCR 链路尚未接入，这里返回可编辑 LaTeX 模板。
  return '$$\n\n$$';
};

export const exportSelectionAsLatex = (
  shapes: ShapeWithId[],
  fileNamePrefix = 'whiteboard-selection'
): boolean => {
  if (shapes.length === 0) return false;

  const { markdownContents, expressions } = extractLatexFromSelection(shapes);
  const nonMarkdownCount = Math.max(0, shapes.length - markdownContents.length);

  const lines: string[] = [
    '\\documentclass{article}',
    '\\usepackage{amsmath}',
    '\\usepackage{amssymb}',
    '\\begin{document}',
    '% Auto-generated from whiteboard selection.',
  ];

  if (expressions.length > 0) {
    lines.push('% Extracted LaTeX expressions:');
    expressions.forEach((expression, index) => {
      lines.push(`% Expression ${index + 1}`);
      lines.push('\\[');
      lines.push(expression);
      lines.push('\\]');
    });
  } else {
    lines.push('% No explicit LaTeX expressions found in selected markdown blocks.');
  }

  if (markdownContents.length > 0) {
    lines.push('% Source markdown blocks:');
    markdownContents.forEach((content, index) => {
      lines.push(`% --- Block ${index + 1} ---`);
      content.split('\n').forEach((line) => {
        lines.push(`% ${line}`);
      });
    });
  }

  if (nonMarkdownCount > 0) {
    lines.push(
      `% Note: ${nonMarkdownCount} non-markdown shape(s) were selected and are not converted to LaTeX in this MVP.`
    );
  }

  lines.push('\\end{document}');
  lines.push('');

  const blob = new Blob([lines.join('\n')], { type: 'application/x-tex' });
  downloadBlob(blob, `${fileNamePrefix}-${getFileTimestamp()}.tex`);
  return true;
};
