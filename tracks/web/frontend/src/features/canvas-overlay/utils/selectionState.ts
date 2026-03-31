import type { ShapeData } from '../../../types';
import type { Bounds } from './shapeGeometry';
export {
  applySelectionIds,
  getSelectionApplyMode,
  orderShapesForSelectionDisplay,
  type SelectionApplyMode,
} from './selectionOrder';

type StateSetter<T> = (value: T) => void;

interface SelectionTransientSetters {
  setPreviewShapes: StateSetter<Map<string, ShapeData>>;
  setSelectionRotationPreview: StateSetter<number | null>;
  setSelectionDisplayBoundsPreview: StateSetter<Bounds | null>;
  setSelectionRect: StateSetter<Bounds | null>;
}

interface ReplaceSelectionSetters extends SelectionTransientSetters {
  setSelectedIds: StateSetter<string[]>;
}

export const resetSelectionTransientState = (
  {
    setPreviewShapes,
    setSelectionRotationPreview,
    setSelectionDisplayBoundsPreview,
    setSelectionRect,
  }: SelectionTransientSetters,
  options?: { clearMarquee?: boolean }
) => {
  setPreviewShapes(new Map());
  setSelectionRotationPreview(null);
  setSelectionDisplayBoundsPreview(null);

  if (options?.clearMarquee !== false) {
    setSelectionRect(null);
  }
};

export const replaceSelectionWithReset = (
  { setSelectedIds, ...transientSetters }: ReplaceSelectionSetters,
  nextIds: string[],
  options?: { clearMarquee?: boolean }
) => {
  setSelectedIds(nextIds);
  resetSelectionTransientState(transientSetters, options);
};
