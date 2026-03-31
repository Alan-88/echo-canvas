import { useMemo } from 'react';
import type { ShapeData } from '../types';
import {
  buildPlainTextFromMarkdownSelection,
  buildSelectionClipboardPayload,
  isMarkdownOnlySelection,
  type SelectionClipboardPayload,
} from '../features/canvas-overlay/utils/selectionClipboard';
import { buildMarkdownLatexContentFromSelection } from '../features/canvas-overlay/utils/selectionExport';
import { getSelectionBounds, type Bounds } from '../features/canvas-overlay/utils/shapeGeometry';

export interface SelectionShapeRef {
  id: string;
  shape: ShapeData;
}

export interface SelectionDomainState {
  selectedShapes: SelectionShapeRef[];
  selectedIds: string[];
  hasSelection: boolean;
  payload: SelectionClipboardPayload | null;
  markdownOnly: boolean;
  plainText: string | null;
  latexMarkdownContent: string | null;
  bounds: Bounds | null;
}

export const useSelectionDomainState = (
  selectedShapesInput?: SelectionShapeRef[]
): SelectionDomainState =>
  useMemo(() => {
    const selectedShapes = selectedShapesInput || [];
    const hasSelection = selectedShapes.length > 0;
    const selectedIds = selectedShapes.map((shape) => shape.id);
    const payload = hasSelection ? buildSelectionClipboardPayload(selectedShapes) : null;
    const markdownOnly = hasSelection && isMarkdownOnlySelection(selectedShapes);
    const plainText = markdownOnly ? buildPlainTextFromMarkdownSelection(selectedShapes) : null;
    const latexMarkdownContent = hasSelection
      ? buildMarkdownLatexContentFromSelection(selectedShapes)
      : null;
    const bounds = hasSelection ? getSelectionBounds(selectedShapes) : null;

    return {
      selectedShapes,
      selectedIds,
      hasSelection,
      payload,
      markdownOnly,
      plainText,
      latexMarkdownContent,
      bounds,
    };
  }, [selectedShapesInput]);
