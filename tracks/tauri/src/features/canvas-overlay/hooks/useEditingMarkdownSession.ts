import { useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export type EditingMarkdownState = {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const useEditingMarkdownSession = () => {
  const [editingMarkdown, setEditingMarkdownState] = useState<EditingMarkdownState | null>(null);
  const editingMarkdownRef = useRef<EditingMarkdownState | null>(null);

  const setEditingMarkdown: Dispatch<SetStateAction<EditingMarkdownState | null>> = (value) => {
    setEditingMarkdownState((previous) => {
      const nextValue =
        typeof value === 'function'
          ? (value as (previousState: EditingMarkdownState | null) => EditingMarkdownState | null)(
              previous
            )
          : value;
      editingMarkdownRef.current = nextValue;
      return nextValue;
    });
  };

  const handleMarkdownContentChange = (content: string) => {
    setEditingMarkdown((previous) => (previous ? { ...previous, content } : null));
  };

  return {
    editingMarkdown,
    editingMarkdownRef,
    setEditingMarkdown,
    handleMarkdownContentChange,
  };
};
