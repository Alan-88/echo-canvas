import type { ShapeData } from '../../../types';
import { getShapeWorldPoints } from './shapeGeometry';
import { isErasableShape } from '../../../utils/shapePolicy';
import type { SceneShapeWithStyle } from './layerSceneState';

interface RenderSceneOptions {
  canvas: HTMLCanvasElement;
  stageScale: number;
  stagePos: { x: number; y: number };
  shapes: SceneShapeWithStyle[];
  draftLinePoints: number[];
  penColor: string;
  penSize: number;
  erasingPreview: Set<string>;
  imageCache: Map<string, HTMLImageElement>;
}

const setCanvasSize = (canvas: HTMLCanvasElement) => {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = window.devicePixelRatio || 1;

  if (
    canvas.width !== Math.round(width * ratio) ||
    canvas.height !== Math.round(height * ratio)
  ) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }

  const context = canvas.getContext('2d');
  if (!context) return null;

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
};

const ensureImage = (
  src: string,
  cache: Map<string, HTMLImageElement>
): HTMLImageElement => {
  const cached = cache.get(src);
  if (cached) return cached;

  const image = new Image();
  image.src = src;
  cache.set(src, image);
  return image;
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

const drawMarkdownCardFrame = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) => {
  buildRoundedRectPath(context, width, height, MARKDOWN_CARD_RADIUS);
  context.fillStyle = 'rgba(255, 255, 255, 0.82)';
  context.fill();
  context.strokeStyle = 'rgba(215, 207, 240, 0.92)';
  context.lineWidth = 1.5;
  context.stroke();
};

const drawLine = (
  context: CanvasRenderingContext2D,
  shape: Extract<ShapeData, { type: 'line' }>,
  opacity: number
) => {
  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0 } = shape.data;
  const points = shape.data.points;
  if (points.length < 2) return;

  context.save();
  context.translate(x, y);
  context.rotate((rotation * Math.PI) / 180);
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
  context.globalAlpha = opacity;
  context.stroke();
  context.restore();
};

const drawRect = (
  context: CanvasRenderingContext2D,
  shape: Extract<ShapeData, { type: 'rect' }>,
  opacity: number
) => {
  const { x, y, width, height, rotation = 0, scaleX = 1, scaleY = 1 } = shape.data;

  context.save();
  context.translate(x, y);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(scaleX, scaleY);
  context.globalAlpha = opacity;
  if (shape.data.fill) {
    context.fillStyle = shape.data.fill;
    context.fillRect(0, 0, width, height);
  }
  context.strokeStyle = shape.data.stroke;
  context.lineWidth = 2;
  context.strokeRect(0, 0, width, height);
  context.restore();
};

const drawImageShape = (
  context: CanvasRenderingContext2D,
  shape: Extract<ShapeData, { type: 'image' }>,
  imageCache: Map<string, HTMLImageElement>,
  opacity: number
) => {
  const { x, y, width, height, src, rotation = 0, scaleX = 1, scaleY = 1 } = shape.data;
  const image = ensureImage(src, imageCache);

  context.save();
  context.translate(x, y);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(scaleX, scaleY);
  context.globalAlpha = opacity;

  if (image.complete) {
    context.drawImage(image, 0, 0, width, height);
  } else {
    context.fillStyle = '#E9E2F7';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#B7A9DA';
    context.strokeRect(0, 0, width, height);
  }

  context.restore();
};

const drawMarkdownShape = (
  context: CanvasRenderingContext2D,
  shape: Extract<ShapeData, { type: 'markdown' }>,
  imageCache: Map<string, HTMLImageElement>,
  opacity: number
) => {
  const {
    x,
    y,
    width,
    height,
    renderedImage,
    rotation = 0,
    scaleX = 1,
    scaleY = 1,
  } = shape.data;
  const image = ensureImage(renderedImage, imageCache);

  context.save();
  context.translate(x, y);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(scaleX, scaleY);
  context.globalAlpha = opacity;
  drawMarkdownCardFrame(context, width, height);

  if (image.complete) {
    buildRoundedRectPath(context, width, height, MARKDOWN_CARD_RADIUS);
    context.clip();
    context.drawImage(image, 0, 0, width, height);
  }

  context.restore();
};

const drawDraftLine = (
  context: CanvasRenderingContext2D,
  points: number[],
  color: string,
  width: number
) => {
  if (points.length < 2) return;

  context.beginPath();
  context.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) {
    context.lineTo(points[index], points[index + 1]);
  }
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke();
};

export const renderScene = ({
  canvas,
  stageScale,
  stagePos,
  shapes,
  draftLinePoints,
  penColor,
  penSize,
  erasingPreview,
  imageCache,
}: RenderSceneOptions) => {
  const context = setCanvasSize(canvas);
  if (!context) return;

  context.save();
  context.translate(stagePos.x, stagePos.y);
  context.scale(stageScale, stageScale);

  shapes.forEach((shape) => {
    const opacity =
      isErasableShape(shape.shape) && erasingPreview.has(shape.id)
        ? Math.min(shape.opacity, 0.2)
        : shape.opacity;

    switch (shape.shape.type) {
      case 'line':
        drawLine(context, shape.shape, opacity);
        break;
      case 'rect':
        drawRect(context, shape.shape, opacity);
        break;
      case 'image':
        drawImageShape(context, shape.shape, imageCache, opacity);
        break;
      case 'markdown':
        drawMarkdownShape(context, shape.shape, imageCache, opacity);
        break;
      default:
        break;
    }
  });

  drawDraftLine(context, draftLinePoints, penColor, penSize);
  context.restore();
};

export const getCanvasSceneShapes = (shapes: SceneShapeWithStyle[]): SceneShapeWithStyle[] => shapes;

export const getShapePolyline = (shape: ShapeData) => getShapeWorldPoints(shape);
