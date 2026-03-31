import type { ShapeData } from '../../../types';
import {
  getShapeBounds,
  type Bounds,
  type ShapeWithId,
} from './shapeGeometry';
import { resolveExportRasterScale } from '../../../utils/exportPngPolicy';
import { buildApiUrl } from '../../../utils/runtimeNetwork';

interface OcrResponsePayload {
  success?: boolean;
  latex?: string;
  confidence?: number;
  provider?: string;
}

const OCR_EXPORT_PADDING = 24;
const OCR_EXPORT_MAX_PIXELS = 2_000_000;

const isLatexOcrCandidate = (shape: ShapeData) =>
  shape.type === 'line' || shape.type === 'rect';

export const getLatexOcrCandidateShapes = (shapes: ShapeWithId[]) =>
  shapes.filter((shape) => isLatexOcrCandidate(shape.shape));

const getShapeBoundsForOcr = (shape: ShapeData): Bounds => {
  const baseBounds = getShapeBounds(shape);
  if (shape.type !== 'line') {
    return baseBounds;
  }

  const padding = Math.max(0, (shape.data.stroke_width ?? 1) / 2);
  return {
    x: baseBounds.x - padding,
    y: baseBounds.y - padding,
    width: baseBounds.width + padding * 2,
    height: baseBounds.height + padding * 2,
  };
};

const getCandidatesBounds = (shapes: ShapeWithId[]): Bounds | null => {
  if (shapes.length === 0) return null;
  const bounds = shapes.map((shape) => getShapeBoundsForOcr(shape.shape));
  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const drawLine = (
  context: CanvasRenderingContext2D,
  shape: Extract<ShapeData, { type: 'line' }>,
  offsetX: number,
  offsetY: number
) => {
  const points = shape.data.points;
  if (points.length < 2) return;

  const x = shape.data.x ?? 0;
  const y = shape.data.y ?? 0;
  const scaleX = shape.data.scaleX ?? 1;
  const scaleY = shape.data.scaleY ?? 1;
  const rotation = shape.data.rotation ?? 0;

  context.save();
  context.translate(x - offsetX, y - offsetY);
  context.rotate(toRadians(rotation));
  context.scale(scaleX, scaleY);
  context.beginPath();
  context.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) {
    context.lineTo(points[index], points[index + 1]);
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

const buildLatexOcrImageDataUrl = (shapes: ShapeWithId[]): string | null => {
  const bounds = getCandidatesBounds(shapes);
  if (!bounds) return null;

  const exportWidth = Math.max(1, bounds.width + OCR_EXPORT_PADDING * 2);
  const exportHeight = Math.max(1, bounds.height + OCR_EXPORT_PADDING * 2);
  const raster = resolveExportRasterScale({
    contentWidth: exportWidth,
    contentHeight: exportHeight,
    pixelRatio: 1,
    maxPixels: OCR_EXPORT_MAX_PIXELS,
  });

  const canvas = document.createElement('canvas');
  canvas.width = raster.rasterWidth;
  canvas.height = raster.rasterHeight;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.setTransform(raster.pixelRatio, 0, 0, raster.pixelRatio, 0, 0);
  context.fillStyle = 'white';
  context.fillRect(0, 0, exportWidth, exportHeight);

  const offsetX = bounds.x - OCR_EXPORT_PADDING;
  const offsetY = bounds.y - OCR_EXPORT_PADDING;

  shapes.forEach((shapeWithId) => {
    const shape = shapeWithId.shape;
    if (shape.type === 'line') {
      drawLine(context, shape, offsetX, offsetY);
      return;
    }
    if (shape.type === 'rect') {
      drawRect(context, shape, offsetX, offsetY);
    }
  });

  return canvas.toDataURL('image/png');
};

const normalizeLatexText = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutDollarBlock =
    trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4
      ? trimmed.slice(2, -2).trim()
      : trimmed;
  if (!withoutDollarBlock) return null;
  return withoutDollarBlock;
};

export const recognizeLatexFromSelection = async (
  selectedShapes: ShapeWithId[]
): Promise<string | null> => {
  const candidateShapes = getLatexOcrCandidateShapes(selectedShapes);
  if (candidateShapes.length === 0) return null;

  const imageDataUrl = buildLatexOcrImageDataUrl(candidateShapes);
  if (!imageDataUrl) return null;

  try {
    const response = await fetch(buildApiUrl('/api/ocr/latex'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageDataUrl }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as OcrResponsePayload;
    if (!payload.success || typeof payload.latex !== 'string') {
      return null;
    }

    return normalizeLatexText(payload.latex);
  } catch {
    return null;
  }
};
