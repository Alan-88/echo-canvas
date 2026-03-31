import type React from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Action, ShapeData } from '../../../types';
import { collectErasableShapeIdsAtPoint } from './eraserHit';
import {
  hitTestShapes,
  type Bounds,
  type Point,
  type ShapeWithId,
} from './shapeGeometry';
import { hitTestRotationHandle } from './selectionRotate';
import { getResizeHandleAtPoint, type ResizeHandle } from './selectionResize';
import { getSelectionApplyMode } from './selectionState';
import { mapShapesWithPreview } from './selectionPreviewShapes';
import { hitTestSelectionInterior, toUnrotatedSelectionPoint } from './selectionFrame';
import {
  commitDrawPointerUp,
  commitErasePointerUp,
  handleTransformPointerUp,
  resolveLassoSelectionPointerUp,
  resolveMarqueeSelectionPointerUp,
  resolvePendingSelectPointerUp,
} from './boardPointerFinalize';
import type { InteractionState, Tool } from './boardInteractionTypes';
import { handleSelectionPointerMove } from './boardPointerMoveSelection';
import { appendDrawSamples, collectDrawSamplePoints } from './drawPointerSamples';

interface CommitContextLike {
  currentCanvasId: string | null;
  currentLayerId: string | null;
  send: (msg: any) => void;
  onTokenStateChange?: (state: 'unsaved') => void;
}

interface CreateBoardPointerHandlersOptions {
  stageScale: number;
  stagePos: Point;
  isSpacePressed: boolean;
  eraserSize: number;
  penConfig: { color: string; size: number };
  currentCanvasId: string | null;
  currentLayerId: string | null;
  selectedIds: string[];
  selectedShapes: ShapeWithId[];
  currentLayerDisplayShapes: ShapeWithId[];
  selectionBounds: Bounds | null;
  selectionRect: Bounds | null;
  selectionLassoPoints: Point[] | null;
  selectionDisplayBounds: Bounds | null;
  selectionRotationDegrees: number;
  selectionTransformBounds: Bounds | null;
  selectionVisualPadding: number;
  enabledResizeHandles: ResizeHandle[];
  rotateEnabled: boolean;
  interactionRef: React.MutableRefObject<InteractionState>;
  currentPointsRef: React.MutableRefObject<number[]>;
  previewShapesRef: React.MutableRefObject<Map<string, ShapeData>>;
  commitContext: CommitContextLike;
  getCanvasPointFromClient: (clientX: number, clientY: number) => Point | null;
  resolveSelectionDragMode: (shiftKey: boolean) => 'marquee' | 'lasso';
  replaceSelection: (ids: string[]) => void;
  resetSelectionTransient: (options?: { clearMarquee?: boolean }) => void;
  applyDraw: (canvasId: string, layerId: string, action: Action) => void;
  applyErase: (canvasId: string, layerId: string, action: Action) => void;
  applyUpdate: (...args: any[]) => void;
  applyBatchUpdate: (...args: any[]) => void;
  send: (msg: any) => void;
  onTokenStateChange?: (state: 'unsaved') => void;
  setStagePos: React.Dispatch<React.SetStateAction<Point>>;
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRightMousePressed: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDrawing: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentPointsState: React.Dispatch<React.SetStateAction<number[]>>;
  setErasingPreview: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectionRect: React.Dispatch<React.SetStateAction<Bounds | null>>;
  setSelectionLassoPoints: React.Dispatch<React.SetStateAction<Point[] | null>>;
  setPreviewShapesState: (nextPreviewShapes: Map<string, ShapeData>) => void;
  setSelectionRotationPreview: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectionDisplayBoundsPreview: React.Dispatch<React.SetStateAction<Bounds | null>>;
}

export const createBoardPointerHandlers = ({
  stageScale,
  stagePos,
  isSpacePressed,
  eraserSize,
  penConfig,
  currentCanvasId,
  currentLayerId,
  selectedIds,
  selectedShapes,
  currentLayerDisplayShapes,
  selectionBounds,
  selectionRect,
  selectionLassoPoints,
  selectionDisplayBounds,
  selectionRotationDegrees,
  selectionTransformBounds,
  selectionVisualPadding,
  enabledResizeHandles,
  rotateEnabled,
  interactionRef,
  currentPointsRef,
  previewShapesRef,
  commitContext,
  getCanvasPointFromClient,
  resolveSelectionDragMode,
  replaceSelection,
  resetSelectionTransient,
  applyDraw,
  applyErase,
  applyUpdate,
  applyBatchUpdate,
  send,
  onTokenStateChange,
  setStagePos,
  setIsPanning,
  setIsRightMousePressed,
  setIsDrawing,
  setCurrentPointsState,
  setErasingPreview,
  setSelectionRect,
  setSelectionLassoPoints,
  setPreviewShapesState,
  setSelectionRotationPreview,
  setSelectionDisplayBoundsPreview,
}: CreateBoardPointerHandlersOptions) => {
  const updateEraserPreview = (point: Point, erasedIds: Set<string>) => {
    const tolerance = Math.max(8, eraserSize / Math.max(stageScale, 0.25));
    const nextIds = collectErasableShapeIdsAtPoint({
      point,
      shapes: currentLayerDisplayShapes,
      tolerance,
      previousIds: erasedIds,
    });
    erasedIds.clear();
    nextIds.forEach((id) => erasedIds.add(id));
    setErasingPreview(nextIds);
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    effectiveTool: Tool
  ) => {
    const point = getCanvasPointFromClient(event.clientX, event.clientY);
    if (!point) return;

    const isMiddleButton = event.button === 1;
    const isRightButton = event.button === 2;
    const isSpacePan = isSpacePressed && event.button === 0;

    if (isRightButton) {
      setIsRightMousePressed(true);
    }

    if (effectiveTool === 'pan' || isMiddleButton || isSpacePan) {
      interactionRef.current = {
        kind: 'pan',
        startPointer: { x: event.clientX, y: event.clientY },
        startStagePos: stagePos,
      };
      setIsPanning(true);
      return;
    }

    if (effectiveTool === 'pen') {
      interactionRef.current = { kind: 'draw', shapeId: uuidv4() };
      setIsDrawing(true);
      setCurrentPointsState([point.x, point.y, point.x + 0.1, point.y + 0.1]);
      return;
    }

    if (effectiveTool === 'eraser') {
      const erasedIds = new Set<string>();
      interactionRef.current = { kind: 'erase', erasedIds };
      setIsDrawing(true);
      updateEraserPreview(point, erasedIds);
      return;
    }

    if (effectiveTool !== 'select') return;
    const currentDisplayBounds = selectionDisplayBounds;
    const selectionMode = getSelectionApplyMode(event);

    const overlayPoint =
      currentDisplayBounds && Math.abs(selectionRotationDegrees) > 0.001
        ? toUnrotatedSelectionPoint(point, currentDisplayBounds, selectionRotationDegrees)
        : point;

    const clickedRotateHandle =
      rotateEnabled &&
      hitTestRotationHandle(currentDisplayBounds, overlayPoint, stageScale);
    if (clickedRotateHandle && selectedShapes.length > 0 && selectionBounds && currentDisplayBounds) {
      setSelectionRotationPreview(selectionRotationDegrees);
      setSelectionDisplayBoundsPreview(currentDisplayBounds);
      interactionRef.current = {
        kind: 'rotate-selection',
        selectionBounds,
        displayBounds: currentDisplayBounds,
        startPoint: point,
        initialShapes: mapShapesWithPreview(selectedShapes, previewShapesRef.current),
      };
      return;
    }

    const clickedHandle = getResizeHandleAtPoint(
      currentDisplayBounds,
      overlayPoint,
      stageScale,
      enabledResizeHandles
    );
    if (
      clickedHandle &&
      selectedShapes.length > 0 &&
      selectionTransformBounds &&
      currentDisplayBounds
    ) {
      setSelectionDisplayBoundsPreview(currentDisplayBounds);
      interactionRef.current = {
        kind: 'scale-selection',
        handle: clickedHandle,
        startPoint: overlayPoint,
        startWorldPoint: point,
        rotationDegrees: selectionRotationDegrees,
        selectionBounds: selectionTransformBounds,
        displayBounds: currentDisplayBounds,
        initialShapes: mapShapesWithPreview(selectedShapes, previewShapesRef.current),
      };
      return;
    }

    const hitShape = hitTestShapes(currentLayerDisplayShapes, point, 6 / Math.max(stageScale, 0.5));
    if (selectionMode === 'toggle' && hitShape) {
      interactionRef.current = {
        kind: 'pending-select',
        startPoint: point,
        shapeId: hitShape.id,
        selectionMode,
      };
      return;
    }

    if (
      selectionMode === 'replace' &&
      selectedShapes.length > 0 &&
      hitTestSelectionInterior(point, currentDisplayBounds, selectionRotationDegrees) &&
      currentDisplayBounds
    ) {
      setSelectionDisplayBoundsPreview(currentDisplayBounds);
      interactionRef.current = {
        kind: 'drag-selection',
        startPoint: point,
        initialDisplayBounds: currentDisplayBounds,
        initialShapes: mapShapesWithPreview(selectedShapes, previewShapesRef.current),
      };
      return;
    }

    if (hitShape) {
      const hitSelectedShape = selectedIds.includes(hitShape.id);

      if (!hitSelectedShape) {
        interactionRef.current = {
          kind: 'pending-select',
          startPoint: point,
          shapeId: hitShape.id,
          selectionMode,
        };
        return;
      }

      const shapesToMove = currentLayerDisplayShapes.filter((shape) =>
        selectedIds.includes(shape.id)
      );

      interactionRef.current = {
        kind: 'drag-selection',
        startPoint: point,
        initialDisplayBounds: selectionDisplayBounds || selectionBounds || {
          x: point.x,
          y: point.y,
          width: 1,
          height: 1,
        },
        initialShapes: shapesToMove,
      };
      return;
    }

    if (selectionMode === 'replace') {
      replaceSelection([]);
    } else {
      resetSelectionTransient({ clearMarquee: false });
      setSelectionLassoPoints(null);
    }

    if (resolveSelectionDragMode(event.shiftKey) === 'lasso') {
      const initialPoints = [point];
      setSelectionLassoPoints(initialPoints);
      interactionRef.current = {
        kind: 'lasso',
        points: initialPoints,
        selectionMode,
      };
      return;
    }

    setSelectionRect({ x: point.x, y: point.y, width: 0, height: 0 });
    interactionRef.current = {
      kind: 'marquee',
      startPoint: point,
      selectionMode,
    };
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
    effectiveTool: Tool
  ) => {
    const interaction = interactionRef.current;

    if (interaction.kind === 'idle') return;

    if (interaction.kind === 'pan') {
      const deltaX = event.clientX - interaction.startPointer.x;
      const deltaY = event.clientY - interaction.startPointer.y;
      setStagePos({
        x: interaction.startStagePos.x + deltaX,
        y: interaction.startStagePos.y + deltaY,
      });
      return;
    }

    const point = getCanvasPointFromClient(event.clientX, event.clientY);
    if (!point) return;

    if (interaction.kind === 'draw' && effectiveTool === 'pen') {
      const nextPoints = appendDrawSamples(
        currentPointsRef.current,
        collectDrawSamplePoints(event, getCanvasPointFromClient)
      );
      if (nextPoints !== currentPointsRef.current) {
        setCurrentPointsState(nextPoints);
      }
      return;
    }

    if (interaction.kind === 'erase' && effectiveTool === 'eraser') {
      updateEraserPreview(point, interaction.erasedIds);
      return;
    }

    if (
      handleSelectionPointerMove({
        interaction,
        point,
        shiftKey: event.shiftKey,
        stageScale,
        selectionVisualPadding,
        resolveSelectionDragMode,
        replaceSelection,
        resetSelectionTransient,
        interactionRef,
        setSelectionRect,
        setSelectionLassoPoints,
        setPreviewShapesState,
        setSelectionDisplayBoundsPreview,
        setSelectionRotationPreview,
      })
    ) {
      return;
    }
  };

  const handlePointerUp = (
    event: React.PointerEvent<HTMLDivElement>,
    effectiveTool: Tool
  ) => {
    if (event.button === 2) {
      setIsRightMousePressed(false);
    }

    const interaction = interactionRef.current;

    if (interaction.kind === 'pan') {
      setIsPanning(false);
      interactionRef.current = { kind: 'idle' };
      return;
    }

    if (interaction.kind === 'draw' && effectiveTool === 'pen') {
      const nextPoints = appendDrawSamples(
        currentPointsRef.current,
        collectDrawSamplePoints(event, getCanvasPointFromClient)
      );
      if (nextPoints !== currentPointsRef.current) {
        setCurrentPointsState(nextPoints);
      }

      commitDrawPointerUp({
        interaction,
        currentCanvasId,
        currentLayerId,
        currentPoints: nextPoints,
        penConfig,
        applyDraw,
        send,
        onTokenStateChange,
      });
      setCurrentPointsState([]);
      setIsDrawing(false);
      interactionRef.current = { kind: 'idle' };
      return;
    }

    if (interaction.kind === 'erase' && effectiveTool === 'eraser') {
      commitErasePointerUp({
        interaction,
        currentCanvasId,
        currentLayerId,
        applyErase,
        send,
        onTokenStateChange,
      });
      setErasingPreview(new Set());
      setIsDrawing(false);
      interactionRef.current = { kind: 'idle' };
      return;
    }

    if (interaction.kind === 'marquee') {
      resolveMarqueeSelectionPointerUp({
        interaction,
        selectionRect,
        currentLayerDisplayShapes,
        selectedIds,
        replaceSelection,
        setSelectionRect,
      });
      setSelectionRect(null);
      interactionRef.current = { kind: 'idle' };
      return;
    }

    if (interaction.kind === 'lasso') {
      resolveLassoSelectionPointerUp({
        interaction,
        selectionLassoPoints,
        currentLayerDisplayShapes,
        selectedIds,
        replaceSelection,
      });
      interactionRef.current = { kind: 'idle' };
      return;
    }

    if (interaction.kind === 'pending-select') {
      resolvePendingSelectPointerUp({
        interaction,
        selectedIds,
        replaceSelection,
      });
      interactionRef.current = { kind: 'idle' };
      return;
    }

    if (
      interaction.kind === 'drag-selection' ||
      interaction.kind === 'scale-selection' ||
      interaction.kind === 'rotate-selection'
    ) {
      void (async () => {
        await handleTransformPointerUp({
          interaction,
          interactionRef,
          previewShapesRef,
          commitContext,
          applyUpdate,
          applyBatchUpdate,
          resetSelectionTransient,
        });
      })();
    }
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
};
