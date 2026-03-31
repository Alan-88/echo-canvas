import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  getMarkdownLayoutHeight,
  getMarkdownLayoutWidth,
} from '../../../utils/markdownShapePersistence';
import type { SceneShapeWithStyle } from '../utils/layerSceneState';

interface MarkdownOverlayLayerProps {
  shapes: SceneShapeWithStyle[];
  selectedIds: string[];
  editingMarkdownId?: string | null;
}

const getMarkdownTransform = (shape: SceneShapeWithStyle) => {
  if (shape.shape.type !== 'markdown') return '';
  const { rotation = 0, scaleX = 1, scaleY = 1 } = shape.shape.data;
  return `rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`;
};

export const MarkdownOverlayLayer: React.FC<MarkdownOverlayLayerProps> = ({
  shapes,
  selectedIds,
  editingMarkdownId,
}) => (
  <>
    {shapes.map((shape) => {
      if (shape.shape.type !== 'markdown') return null;
      if (editingMarkdownId === shape.id) return null;

      const markdownData = shape.shape.data;
      const width = getMarkdownLayoutWidth(markdownData);
      const height = getMarkdownLayoutHeight(markdownData);
      const isSelected = selectedIds.includes(shape.id);

      return (
        <div
          key={shape.id}
          className={`absolute overflow-hidden rounded-xl border shadow-sm ${
            isSelected ? 'border-[#4B7BF5]/70 bg-white/92' : 'border-[#D7CFF0]/90 bg-white/82'
          }`}
          style={{
            left: `${markdownData.x}px`,
            top: `${markdownData.y}px`,
            width: `${width}px`,
            height: `${height}px`,
            transform: getMarkdownTransform(shape),
            transformOrigin: 'top left',
            opacity: shape.opacity,
            boxSizing: 'border-box',
          }}
        >
          <div className="markdown-content h-full w-full overflow-hidden break-words px-3 py-3 text-[16px] leading-[1.6] text-[#2E2A46]">
            <ReactMarkdown
              remarkPlugins={[remarkBreaks, remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {markdownData.content || ' '}
            </ReactMarkdown>
          </div>
        </div>
      );
    })}
  </>
);
