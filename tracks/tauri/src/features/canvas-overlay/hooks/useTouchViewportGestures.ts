import { useRef, type MutableRefObject } from 'react';
import { clampStageScale, getPointerAnchoredStagePosition } from '../utils/viewportMath';
import { hitTestShapes, type ShapeWithId } from '../utils/shapeGeometry';
import { hitTestSelectionInterior } from '../utils/selectionFrame';
import {
  getMarkdownLayoutHeight,
  getMarkdownLayoutWidth,
} from '../../../utils/markdownShapePersistence';
import type { CanvasOverlayBoardState } from './useCanvasOverlayBoard';

type Tool = 'pen' | 'eraser' | 'select' | 'pan';

type TouchPoint = {
  clientX: number;
  clientY: number;
};

type GestureState =
  | { kind: 'idle' }
  | {
      kind: 'pinch';
      anchorScenePoint: { x: number; y: number };
      startScale: number;
      startDistance: number;
    }
  | {
      kind: 'single-pan';
      touchId: number;
      startClientPoint: TouchPoint;
      startStagePos: { x: number; y: number };
    }
  | {
      kind: 'pending-touch';
      touchId: number;
      startClientPoint: TouchPoint;
      currentClientPoint: TouchPoint;
      insideSelection: boolean;
      longPressOpened: boolean;
      target:
        | {
            shapeId: string;
            shapeType: 'image' | 'markdown';
            wasSelected: boolean;
            wasSoleSelected: boolean;
          }
        | null;
    }
  | {
      kind: 'board-select-drag';
      touchId: number;
    };

interface UseTouchViewportGesturesOptions {
  board: Pick<
    CanvasOverlayBoardState,
    | 'stagePos'
    | 'stageScale'
    | 'surfaceRef'
    | 'cancelActiveInteraction'
    | 'setViewportTransform'
    | 'getCanvasPointFromClient'
    | 'currentLayerShapes'
    | 'selectedIds'
    | 'replaceSelection'
    | 'selectionDisplayBounds'
    | 'selectionRotationDegrees'
  >;
  stylusModeEnabled: boolean;
  activePointerToolRef: MutableRefObject<Tool | null>;
  onEditMarkdown: (data: {
    id: string;
    content: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  startBoardSelectionInteraction: (
    event: Pick<
      React.PointerEvent<HTMLDivElement>,
      'clientX' | 'clientY' | 'button' | 'shiftKey' | 'metaKey' | 'ctrlKey'
    >
  ) => void;
  moveBoardSelectionInteraction: (
    event: Pick<React.PointerEvent<HTMLDivElement>, 'clientX' | 'clientY' | 'shiftKey'>
  ) => void;
  endBoardSelectionInteraction: (
    event: Pick<React.PointerEvent<HTMLDivElement>, 'clientX' | 'clientY' | 'button'>
  ) => void;
  openContextMenu: (options: {
    clientX: number;
    clientY: number;
    kind: 'empty' | 'selection';
  }) => void;
}

const getTouchEntries = (touches: Map<number, TouchPoint>) => Array.from(touches.entries()).slice(0, 2);

const getDistance = ([, first]: [number, TouchPoint], [, second]: [number, TouchPoint]) =>
  Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);

const getMidpoint = ([, first]: [number, TouchPoint], [, second]: [number, TouchPoint]) => ({
  x: (first.clientX + second.clientX) / 2,
  y: (first.clientY + second.clientY) / 2,
});

const isTouchSelectableShape = (
  shape: ShapeWithId | null
): shape is ShapeWithId & { shape: { type: 'image' | 'markdown'; data: Record<string, unknown> } } =>
  Boolean(shape && (shape.shape.type === 'image' || shape.shape.type === 'markdown'));

export const useTouchViewportGestures = ({
  board,
  stylusModeEnabled,
  activePointerToolRef,
  onEditMarkdown,
  startBoardSelectionInteraction,
  moveBoardSelectionInteraction,
  endBoardSelectionInteraction,
  openContextMenu,
}: UseTouchViewportGesturesOptions) => {
  const activeTouchesRef = useRef<Map<number, TouchPoint>>(new Map());
  const gestureRef = useRef<GestureState>({ kind: 'idle' });
  const suppressTouchToolingRef = useRef(false);
  const touchDragThresholdRef = useRef(10);
  const longPressTimerRef = useRef<number | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const armLongPressTimer = () => {
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      const gesture = gestureRef.current;
      if (gesture.kind !== 'pending-touch' || gesture.longPressOpened) return;

      if (gesture.target) {
        if (!gesture.target.wasSelected) {
          board.replaceSelection([gesture.target.shapeId]);
        }
        openContextMenu({
          clientX: gesture.currentClientPoint.clientX,
          clientY: gesture.currentClientPoint.clientY,
          kind: 'selection',
        });
      } else if (gesture.insideSelection && board.selectedIds.length > 0) {
        openContextMenu({
          clientX: gesture.currentClientPoint.clientX,
          clientY: gesture.currentClientPoint.clientY,
          kind: 'selection',
        });
      } else {
        openContextMenu({
          clientX: gesture.currentClientPoint.clientX,
          clientY: gesture.currentClientPoint.clientY,
          kind: 'empty',
        });
      }

      gestureRef.current = {
        ...gesture,
        longPressOpened: true,
      };
    }, 420);
  };

  const beginPendingTouch = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = board.getCanvasPointFromClient(event.clientX, event.clientY);
    const hitShape = point
      ? hitTestShapes(board.currentLayerShapes, point, 10 / Math.max(board.stageScale, 0.5))
      : null;
    const eligibleShape = isTouchSelectableShape(hitShape) ? hitShape : null;
    const insideSelection =
      point !== null &&
      hitTestSelectionInterior(
        point,
        board.selectionDisplayBounds,
        board.selectionRotationDegrees
      );

    gestureRef.current = {
      kind: 'pending-touch',
      touchId: event.pointerId,
      startClientPoint: { clientX: event.clientX, clientY: event.clientY },
      currentClientPoint: { clientX: event.clientX, clientY: event.clientY },
      insideSelection,
      longPressOpened: false,
      target: eligibleShape
        ? {
            shapeId: eligibleShape.id,
            shapeType: eligibleShape.shape.type,
            wasSelected: board.selectedIds.includes(eligibleShape.id),
            wasSoleSelected:
              board.selectedIds.length === 1 && board.selectedIds[0] === eligibleShape.id,
          }
        : null,
    };
    armLongPressTimer();
    return true;
  };

  const startPinchGesture = () => {
    const surface = board.surfaceRef.current;
    const touchEntries = getTouchEntries(activeTouchesRef.current);
    if (!surface || touchEntries.length < 2) return false;

    const midpoint = getMidpoint(touchEntries[0], touchEntries[1]);
    const rect = surface.getBoundingClientRect();
    const localMidpoint = {
      x: midpoint.x - rect.left,
      y: midpoint.y - rect.top,
    };

    board.cancelActiveInteraction();
    activePointerToolRef.current = null;
    suppressTouchToolingRef.current = true;
    clearLongPressTimer();
    gestureRef.current = {
      kind: 'pinch',
      anchorScenePoint: {
        x: (localMidpoint.x - board.stagePos.x) / board.stageScale,
        y: (localMidpoint.y - board.stagePos.y) / board.stageScale,
      },
      startScale: board.stageScale,
      startDistance: Math.max(getDistance(touchEntries[0], touchEntries[1]), 1),
    };

    return true;
  };

  const continuePinchGesture = () => {
    const surface = board.surfaceRef.current;
    const gesture = gestureRef.current;
    const touchEntries = getTouchEntries(activeTouchesRef.current);
    if (!surface || gesture.kind !== 'pinch' || touchEntries.length < 2) return false;

    const midpoint = getMidpoint(touchEntries[0], touchEntries[1]);
    const currentDistance = Math.max(getDistance(touchEntries[0], touchEntries[1]), 1);
    const nextScale = clampStageScale(
      gesture.startScale * (currentDistance / Math.max(gesture.startDistance, 1))
    );
    const rect = surface.getBoundingClientRect();
    const localMidpoint = {
      x: midpoint.x - rect.left,
      y: midpoint.y - rect.top,
    };

    board.setViewportTransform({
      stageScale: nextScale,
      stagePos: getPointerAnchoredStagePosition(
        localMidpoint,
        gesture.anchorScenePoint,
        nextScale
      ),
    });

    gestureRef.current = {
      kind: 'pinch',
      anchorScenePoint: gesture.anchorScenePoint,
      startScale: gesture.startScale,
      startDistance: gesture.startDistance,
    };

    return true;
  };

  const startSinglePanGesture = () => {
    const touchEntries = getTouchEntries(activeTouchesRef.current);
    if (touchEntries.length !== 1) return false;

    const [touchId, touchPoint] = touchEntries[0];
    gestureRef.current = {
      kind: 'single-pan',
      touchId,
      startClientPoint: touchPoint,
      startStagePos: board.stagePos,
    };
    return true;
  };

  const clearGestureState = () => {
    clearLongPressTimer();
    if (activeTouchesRef.current.size === 0) {
      gestureRef.current = { kind: 'idle' };
      suppressTouchToolingRef.current = false;
      activePointerToolRef.current = null;
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return false;

    activeTouchesRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });

    if (activeTouchesRef.current.size >= 2) {
      event.preventDefault();
      return startPinchGesture();
    }

    if (stylusModeEnabled) {
      event.preventDefault();
      return beginPendingTouch(event);
    }

    return suppressTouchToolingRef.current;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return false;
    if (!activeTouchesRef.current.has(event.pointerId)) return false;

    activeTouchesRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });

    if (activeTouchesRef.current.size >= 2) {
      event.preventDefault();
      if (gestureRef.current.kind !== 'pinch') {
        return startPinchGesture();
      }
      return continuePinchGesture();
    }

    if (gestureRef.current.kind === 'pending-touch' && gestureRef.current.touchId === event.pointerId) {
      gestureRef.current.currentClientPoint = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      if (gestureRef.current.longPressOpened) {
        return true;
      }
      const deltaX = event.clientX - gestureRef.current.startClientPoint.clientX;
      const deltaY = event.clientY - gestureRef.current.startClientPoint.clientY;
      if (Math.hypot(deltaX, deltaY) < touchDragThresholdRef.current) {
        return true;
      }
      clearLongPressTimer();

      if (gestureRef.current.target?.wasSelected) {
        activePointerToolRef.current = 'select';
        startBoardSelectionInteraction({
          clientX: gestureRef.current.startClientPoint.clientX,
          clientY: gestureRef.current.startClientPoint.clientY,
          button: 0,
          shiftKey: false,
          metaKey: false,
          ctrlKey: false,
        });
        gestureRef.current = {
          kind: 'board-select-drag',
          touchId: event.pointerId,
        };
        moveBoardSelectionInteraction({
          clientX: event.clientX,
          clientY: event.clientY,
          shiftKey: false,
        });
        return true;
      }

      startSinglePanGesture();
      return true;
    }

    if (gestureRef.current.kind === 'single-pan' && gestureRef.current.touchId === event.pointerId) {
      const deltaX = event.clientX - gestureRef.current.startClientPoint.clientX;
      const deltaY = event.clientY - gestureRef.current.startClientPoint.clientY;
      board.setViewportTransform({
        stagePos: {
          x: gestureRef.current.startStagePos.x + deltaX,
          y: gestureRef.current.startStagePos.y + deltaY,
        },
      });
      return true;
    }

    if (gestureRef.current.kind === 'board-select-drag' && gestureRef.current.touchId === event.pointerId) {
      moveBoardSelectionInteraction({
        clientX: event.clientX,
        clientY: event.clientY,
        shiftKey: false,
      });
      return true;
    }

    return suppressTouchToolingRef.current;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return false;
    clearLongPressTimer();

    const handled =
      suppressTouchToolingRef.current ||
      gestureRef.current.kind === 'pinch' ||
      gestureRef.current.kind === 'single-pan' ||
      gestureRef.current.kind === 'pending-touch' ||
      gestureRef.current.kind === 'board-select-drag';

    if (gestureRef.current.kind === 'pending-touch' && gestureRef.current.touchId === event.pointerId) {
      const target = gestureRef.current.target;
      if (gestureRef.current.longPressOpened) {
        // Long press owns the interaction and must not mutate selection or editing state.
      } else if (!target) {
        board.replaceSelection([]);
      } else if (target.shapeType === 'markdown' && target.wasSoleSelected) {
        const shape = board.currentLayerShapes.find((item) => item.id === target.shapeId);
        if (shape?.shape.type === 'markdown') {
          const markdownData = shape.shape.data;
          onEditMarkdown({
            id: shape.id,
            content: markdownData.content,
            x: markdownData.x,
            y: markdownData.y,
            width: getMarkdownLayoutWidth(markdownData),
            height: getMarkdownLayoutHeight(markdownData),
          });
        }
      } else {
        board.replaceSelection([target.shapeId]);
      }
    }

    if (gestureRef.current.kind === 'board-select-drag' && gestureRef.current.touchId === event.pointerId) {
      endBoardSelectionInteraction({
        clientX: event.clientX,
        clientY: event.clientY,
        button: 0,
      });
      activePointerToolRef.current = null;
    }

    activeTouchesRef.current.delete(event.pointerId);

    if (activeTouchesRef.current.size >= 2) {
      return handled;
    }

    if (activeTouchesRef.current.size === 1) {
      if (gestureRef.current.kind === 'pinch' && stylusModeEnabled) {
        startSinglePanGesture();
        return true;
      }
      return handled;
    }

    clearGestureState();
    return handled;
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
};
