import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MIN_MARKDOWN_WIDTH } from '../../utils/markdownShapePersistence';
import { MIN_MARKDOWN_HEIGHT } from '../../utils/markdownShapePersistence';

interface MarkdownEditorProps {
  isOpen: boolean;
  initialContent: string;
  position: { x: number; y: number; width: number; height: number };
  stageScale: number;
  stagePos: { x: number; y: number };
  onChange: (content: string) => void;
  onResize: (size: { width: number; height: number }) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  isOpen,
  initialContent,
  position,
  stageScale,
  stagePos,
  onChange,
  onResize,
  onSave,
  onCancel,
}) => {
  const [content, setContent] = useState(initialContent);
  const [draftSize, setDraftSize] = useState<{ width: number; height: number } | null>(null);
  const [resizeSession, setResizeSession] = useState<{
    startClientX: number;
    startClientY: number;
    startWidth: number;
    startHeight: number;
    stageScale: number;
  } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isCommittingRef = useRef(false);

  useLayoutEffect(() => {
    setContent(initialContent);
    isCommittingRef.current = false;
    setDraftSize(null);
    setResizeSession(null);
  }, [initialContent, isOpen]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const commitAndClose = async () => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;
    try {
      if (content.trim() === '') {
        onCancel();
      } else {
        await onSave();
      }
    } finally {
      isCommittingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const editor = editorRef.current;
      if (!editor) return;
      if (editor.contains(event.target as Node)) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[data-whiteboard-surface="true"]')
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
      void commitAndClose();
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
    };
  }, [isOpen, content, onSave, onCancel]);

  useEffect(() => {
    if (!resizeSession) return;

    const handlePointerMove = (event: PointerEvent) => {
      const deltaX = (event.clientX - resizeSession.startClientX) / resizeSession.stageScale;
      const deltaY = (event.clientY - resizeSession.startClientY) / resizeSession.stageScale;
      const nextSize = {
        width: Math.max(MIN_MARKDOWN_WIDTH, Math.round(resizeSession.startWidth + deltaX)),
        height: Math.max(MIN_MARKDOWN_HEIGHT, Math.round(resizeSession.startHeight + deltaY)),
      };
      setDraftSize(nextSize);
      onResize(nextSize);
    };

    const handlePointerUp = () => {
      if (draftSize) {
        onResize(draftSize);
      }
      setDraftSize(null);
      setResizeSession(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [draftSize, resizeSession, onResize]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    onChange(newContent);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      void commitAndClose();
    }
  };

  if (!isOpen) return null;

  const screenX = position.x * stageScale + stagePos.x;
  const screenY = position.y * stageScale + stagePos.y;
  const effectiveWidth = draftSize?.width ?? position.width;
  const effectiveHeight = draftSize?.height ?? position.height;
  const screenWidth = Math.max(effectiveWidth * stageScale, MIN_MARKDOWN_WIDTH * stageScale);
  const screenHeight = Math.max(effectiveHeight * stageScale, MIN_MARKDOWN_HEIGHT * stageScale);

  return (
    <div
      ref={editorRef}
      className="fixed z-[1000] overflow-visible rounded-xl border border-[#4B7BF5] bg-white/96 shadow-xl"
      style={{
        left: `${screenX}px`,
        top: `${screenY}px`,
        width: `${screenWidth}px`,
        height: `${screenHeight}px`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="absolute -bottom-1.5 -right-1.5 z-[1001] h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-[#4B7BF5] bg-white shadow-sm"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          setResizeSession({
            startClientX: event.clientX,
            startClientY: event.clientY,
            startWidth: Math.max(effectiveWidth, MIN_MARKDOWN_WIDTH),
            startHeight: Math.max(effectiveHeight, MIN_MARKDOWN_HEIGHT),
            stageScale: Math.max(stageScale, 0.001),
          });
        }}
      />
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-full w-full resize-none overflow-auto rounded-xl bg-transparent px-3 py-3 text-[16px] leading-[1.6] text-[#2E2A46] outline-none"
        placeholder="Type markdown here..."
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
};
