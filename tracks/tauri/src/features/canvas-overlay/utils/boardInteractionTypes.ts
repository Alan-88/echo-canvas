import type { SelectionApplyMode } from './selectionState';
import type { Point } from './shapeGeometry';
import type { SelectionTransformState } from './selectionTransformSession';

export type Tool = 'pen' | 'eraser' | 'select' | 'pan' | 'markdown' | 'image';

export type InteractionState =
  | { kind: 'idle' }
  | {
      kind: 'pan';
      startPointer: Point;
      startStagePos: Point;
    }
  | { kind: 'draw'; shapeId: string }
  | {
      kind: 'erase';
      erasedIds: Set<string>;
    }
  | {
      kind: 'marquee';
      startPoint: Point;
      selectionMode: SelectionApplyMode;
    }
  | {
      kind: 'lasso';
      points: Point[];
      selectionMode: SelectionApplyMode;
    }
  | {
      kind: 'pending-select';
      startPoint: Point;
      shapeId: string;
      selectionMode: SelectionApplyMode;
    }
  | SelectionTransformState;
