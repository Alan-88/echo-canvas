import type { ShapeData } from '../types';
import {
  MIN_MARKDOWN_HEIGHT,
  MIN_MARKDOWN_WIDTH,
  getMarkdownLayoutHeight,
  getMarkdownLayoutWidth,
  normalizeMarkdownShapeData,
  rerenderMarkdownShape,
} from './markdownShapePersistence';

export interface TransformNodeLike {
  x(): number;
  y(): number;
  rotation(): number;
  scaleX(): number;
  scaleY(): number;
  width?(): number;
  height?(): number;
}

interface ShapeWithShape {
  shape: ShapeData;
}

const DEFAULT_ENABLED_ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export const getTransformerConfig = (selectedShapes: ShapeWithShape[]) => {
  const hasMarkdown = selectedShapes.some((shapeWithId) => shapeWithId.shape.type === 'markdown');

  if (selectedShapes.length === 1 && selectedShapes[0]?.shape.type === 'markdown') {
    return {
      rotateEnabled: false,
      enabledAnchors: ['bottom-right'],
    };
  }

  if (selectedShapes.length > 1 && hasMarkdown) {
    return {
      rotateEnabled: false,
      enabledAnchors: [] as string[],
    };
  }

  return {
    rotateEnabled: true,
    enabledAnchors: DEFAULT_ENABLED_ANCHORS,
  };
};

export const snapshotNodeTransform = (node: any): TransformNodeLike => ({
  x: () => node.x(),
  y: () => node.y(),
  rotation: () => node.rotation(),
  scaleX: () => node.scaleX(),
  scaleY: () => node.scaleY(),
  width: typeof node.width === 'function' ? () => node.width() : undefined,
  height: typeof node.height === 'function' ? () => node.height() : undefined,
});

export const hideMarkdownNodeDuringRerender = (node: any) => {
  node.opacity(0);
  node.getLayer()?.batchDraw();
};

export const restoreMarkdownNodeAfterRerenderFailure = (node: any) => {
  node.opacity(1);
  node.getLayer()?.batchDraw();
};

export const resetMarkdownNodeAfterTransform = (node: any) => {
  node.scaleX(1);
  node.scaleY(1);
  node.rotation(0);
  node.opacity(1);
  node.getLayer()?.batchDraw();
};

export const buildTransformedShape = async (
  originalShapeData: ShapeData,
  node: TransformNodeLike,
  options: { rerenderMarkdown?: boolean } = {}
): Promise<ShapeData> => {
  if (originalShapeData.type === 'line') {
    return {
      type: 'line',
      data: {
        ...originalShapeData.data,
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      },
    };
  }

  if (originalShapeData.type === 'image') {
    return {
      type: 'image',
      data: {
        x: node.x(),
        y: node.y(),
        width: originalShapeData.data.width,
        height: originalShapeData.data.height,
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
        src: '',
      },
    };
  }

  const rerenderMarkdown =
    options.rerenderMarkdown ??
    (Math.abs(node.scaleX() - 1) > 0.001 || Math.abs(node.scaleY() - 1) > 0.001);

  const markdownShape = originalShapeData as Extract<ShapeData, { type: 'markdown' }>;
  const transformedWidth =
    (typeof node.width === 'function' ? node.width() : getMarkdownLayoutWidth(markdownShape.data)) *
    Math.abs(node.scaleX());
  const transformedHeight =
    (typeof node.height === 'function'
      ? node.height()
      : getMarkdownLayoutHeight(markdownShape.data)) * Math.abs(node.scaleY());
  const markdownData = rerenderMarkdown
    ? await rerenderMarkdownShape(markdownShape, {
        x: node.x(),
        y: node.y(),
        width: Math.max(MIN_MARKDOWN_WIDTH, transformedWidth),
        height: Math.max(MIN_MARKDOWN_HEIGHT, transformedHeight),
      })
    : normalizeMarkdownShapeData(markdownShape.data, {
        x: node.x(),
        y: node.y(),
      });

  return {
    type: 'markdown',
    data: markdownData,
  };
};
