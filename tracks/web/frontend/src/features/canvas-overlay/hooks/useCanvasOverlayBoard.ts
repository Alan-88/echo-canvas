import { useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ShapeData } from '../../../types';
import { useWhiteboardStore } from '../../../store/useWhiteboardStore';
import { MIN_MARKDOWN_WIDTH } from '../../../utils/markdownShapePersistence';
import {
  getSelectionBounds,
  type Bounds,
  type Point,
  type ShapeWithId,
} from '../utils/shapeGeometry';
import { getEnabledResizeHandles } from '../utils/selectionResize';
import { canRotateSelection } from '../utils/selectionRotate';
import {
  clampStageScale,
  getCenteredStagePosition,
  getPointerAnchoredStagePosition,
  getViewportCenterScenePoint,
} from '../utils/viewportMath';
import { useCanvasOverlayModifiers } from './useCanvasOverlayModifiers';
import {
  expandSelectionBounds,
  getSelectionOverlayRotation,
  getSelectionVisualPadding,
} from '../utils/selectionOverlayState';
import { getSelectionTransformBounds } from '../utils/selectionTransformBounds';
import {
  commitClear,
  commitMarkdownSave,
  commitRedo,
  commitUndo,
} from '../utils/boardActions';
import {
  orderShapesForSelectionDisplay,
  replaceSelectionWithReset,
  resetSelectionTransientState,
} from '../utils/selectionState';
import {
  createBoardPointerHandlers,
} from '../utils/boardPointerHandlers';
import { useSelectionModePreference } from './useSelectionModePreference';
import { buildLayerSceneShapes, type SceneShapeWithStyle } from '../utils/layerSceneState';
import {
  useEditingMarkdownSession,
  type EditingMarkdownState,
} from './useEditingMarkdownSession';
import type { InteractionState, Tool } from '../utils/boardInteractionTypes';

export interface CanvasOverlayBoardState {
  stageScale: number;
  stagePos: { x: number; y: number };
  surfaceRef: React.MutableRefObject<HTMLDivElement | null>;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  stageRef: React.MutableRefObject<null>;
  isDrawing: boolean;
  currentPoints: number[];
  erasingPreview: Set<string>;
  isSpacePressed: boolean;
  isAltPressed: boolean;
  isRightMousePressed: boolean;
  isPanning: boolean;
  editingMarkdown: EditingMarkdownState | null;
  setEditingMarkdown: React.Dispatch<React.SetStateAction<EditingMarkdownState | null>>;
  selectedIds: string[];
  selectionRect: Bounds | null;
  selectionLassoPoints: Point[] | null;
  selectionBounds: Bounds | null;
  selectionDisplayBounds: Bounds | null;
  selectionRotationDegrees: number;
  renderShapes: SceneShapeWithStyle[];
  currentLayerShapes: ShapeWithId[];
  selectedShapes: ShapeWithId[];
  handleMarkdownContentChange: (content: string) => void;
  handleSaveMarkdown: () => Promise<void>;
  replaceSelection: (ids: string[]) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleClear: () => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
  getCanvasPointFromClient: (clientX: number, clientY: number) => Point | null;
  handlePointerDown: (event: React.PointerEvent<HTMLDivElement>, effectiveTool: Tool) => void;
  handlePointerMove: (event: React.PointerEvent<HTMLDivElement>, effectiveTool: Tool) => void;
  handlePointerUp: (event: React.PointerEvent<HTMLDivElement>, effectiveTool: Tool) => void;
  handleWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  cancelActiveInteraction: () => void;
  setViewportTransform: (next: { stagePos: Point; stageScale?: number }) => void;
}

export const useCanvasOverlayBoard = (
  _tool: Tool,
  penConfig: { color: string; size: number },
  eraserSize: number,
  currentCanvasId: string | null,
  currentLayerId: string | null,
  allVisibleShapes: Record<string, any[]>,
  send: (msg: any) => void,
  onTokenStateChange?: (state: 'unsaved') => void
): CanvasOverlayBoardState => {
  const applyDraw = useWhiteboardStore((state) => state.applyDraw);
  const applyErase = useWhiteboardStore((state) => state.applyErase);
  const applyUndo = useWhiteboardStore((state) => state.applyUndo);
  const applyRedo = useWhiteboardStore((state) => state.applyRedo);
  const applyUpdate = useWhiteboardStore((state) => state.applyUpdate);
  const applyBatchUpdate = useWhiteboardStore((state) => state.applyBatchUpdate);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<null>(null);
  const interactionRef = useRef<InteractionState>({ kind: 'idle' });

  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const currentPointsRef = useRef<number[]>([]);
  const [erasingPreview, setErasingPreview] = useState<Set<string>>(new Set());
  const {
    editingMarkdown,
    editingMarkdownRef,
    setEditingMarkdown,
    handleMarkdownContentChange,
  } = useEditingMarkdownSession();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState<Bounds | null>(null);
  const [selectionLassoPoints, setSelectionLassoPoints] = useState<Point[] | null>(null);
  const [previewShapes, setPreviewShapes] = useState<Map<string, ShapeData>>(new Map());
  const previewShapesRef = useRef<Map<string, ShapeData>>(new Map());
  const [selectionRotationPreview, setSelectionRotationPreview] = useState<number | null>(null);
  const [selectionDisplayBoundsPreview, setSelectionDisplayBoundsPreview] =
    useState<Bounds | null>(null);
  const setCurrentPointsState: React.Dispatch<React.SetStateAction<number[]>> = (value) => {
    setCurrentPoints((previous) => {
      const nextValue =
        typeof value === 'function'
          ? (value as (previousState: number[]) => number[])(previous)
          : value;
      currentPointsRef.current = nextValue;
      return nextValue;
    });
  };
  const setPreviewShapesState = (nextPreviewShapes: Map<string, ShapeData>) => {
    previewShapesRef.current = nextPreviewShapes;
    setPreviewShapes(nextPreviewShapes);
  };
  const {
    isSpacePressed,
    isAltPressed,
    isRightMousePressed,
    isPanning,
    setIsRightMousePressed,
    setIsPanning,
  } = useCanvasOverlayModifiers({
    editingMarkdownOpen: Boolean(editingMarkdown),
  });
  const { resolveSelectionDragMode } = useSelectionModePreference();

  const currentLayerShapes: ShapeWithId[] = useMemo(
    () => (currentLayerId ? allVisibleShapes[currentLayerId] || [] : []),
    [allVisibleShapes, currentLayerId]
  );

  const renderShapes: SceneShapeWithStyle[] = useMemo(
    () =>
      buildLayerSceneShapes({
        allVisibleShapes,
        currentLayerId,
        previewShapes,
        selectedIds,
      }),
    [allVisibleShapes, currentLayerId, previewShapes, selectedIds]
  );

  const currentLayerDisplayShapes: ShapeWithId[] = useMemo(
    () =>
      orderShapesForSelectionDisplay(
        currentLayerShapes.map((shapeWithId) => ({
          ...shapeWithId,
          shape: previewShapes.get(shapeWithId.id) || shapeWithId.shape,
        })),
        selectedIds
      ),
    [currentLayerShapes, previewShapes, selectedIds]
  );

  const selectedShapes = useMemo(
    () =>
      currentLayerDisplayShapes.filter((shapeWithId) => selectedIds.includes(shapeWithId.id)),
    [currentLayerDisplayShapes, selectedIds]
  );

  const selectionBounds = useMemo(() => getSelectionBounds(selectedShapes), [selectedShapes]);
  const selectionTransformBounds = useMemo(
    () => getSelectionTransformBounds(selectedShapes, selectionBounds),
    [selectedShapes, selectionBounds]
  );
  const enabledResizeHandles = useMemo(() => getEnabledResizeHandles(selectedShapes), [selectedShapes]);
  const rotateEnabled = useMemo(() => canRotateSelection(selectedShapes), [selectedShapes]);
  const selectionVisualPadding = useMemo(() => getSelectionVisualPadding(stageScale), [stageScale]);
  const selectionDisplayBounds = useMemo(
    () =>
      selectionDisplayBoundsPreview ||
      (selectionTransformBounds
        ? expandSelectionBounds(selectionTransformBounds, selectionVisualPadding)
        : null),
    [selectionDisplayBoundsPreview, selectionTransformBounds, selectionVisualPadding]
  );
  const selectionRotationDegrees = useMemo(
    () => getSelectionOverlayRotation(selectedShapes, selectionRotationPreview),
    [selectedShapes, selectionRotationPreview]
  );

  const getCanvasPointFromClient = (clientX: number, clientY: number) => {
    const surface = surfaceRef.current;
    if (!surface) return null;

    const rect = surface.getBoundingClientRect();
    return {
      x: (clientX - rect.left - stagePos.x) / stageScale,
      y: (clientY - rect.top - stagePos.y) / stageScale,
    };
  };

  const commitContext = useMemo(
    () => ({
      currentCanvasId,
      currentLayerId,
      send,
      onTokenStateChange,
    }),
    [currentCanvasId, currentLayerId, onTokenStateChange, send]
  );

  const handleSaveMarkdown = async () => {
    const markdownDraft = editingMarkdownRef.current;
    if (!markdownDraft) return;

    try {
      await commitMarkdownSave(
        commitContext,
        { applyDraw, applyUpdate },
        {
          id: markdownDraft.id,
          content: markdownDraft.content,
          x: markdownDraft.x,
          y: markdownDraft.y,
          width: Math.max(markdownDraft.width || 400, MIN_MARKDOWN_WIDTH),
          height: markdownDraft.height,
        },
        currentLayerShapes,
        () => uuidv4()
      );
    } finally {
      setEditingMarkdown(null);
    }
  };

  const resetSelectionTransient = (options?: { clearMarquee?: boolean }) => {
    resetSelectionTransientState(
      {
        setPreviewShapes: setPreviewShapesState,
        setSelectionRotationPreview,
        setSelectionDisplayBoundsPreview,
        setSelectionRect,
      },
      options
    );
    setSelectionLassoPoints(null);
  };

  const replaceSelection = (ids: string[]) => {
    replaceSelectionWithReset(
      {
        setSelectedIds,
        setPreviewShapes: setPreviewShapesState,
        setSelectionRotationPreview,
        setSelectionDisplayBoundsPreview,
        setSelectionRect,
      },
      ids
    );
    setSelectionLassoPoints(null);
    interactionRef.current = { kind: 'idle' };
  };

  const cancelActiveInteraction = () => {
    const interaction = interactionRef.current;

    if (interaction.kind === 'pan') {
      setIsPanning(false);
    }

    if (interaction.kind === 'draw') {
      setCurrentPointsState([]);
      setIsDrawing(false);
    }

    if (interaction.kind === 'erase') {
      setErasingPreview(new Set());
      setIsDrawing(false);
    }

    if (
      interaction.kind === 'marquee' ||
      interaction.kind === 'lasso' ||
      interaction.kind === 'pending-select' ||
      interaction.kind === 'drag-selection' ||
      interaction.kind === 'scale-selection' ||
      interaction.kind === 'rotate-selection'
    ) {
      resetSelectionTransient({ clearMarquee: true });
      setSelectionLassoPoints(null);
    }

    interactionRef.current = { kind: 'idle' };
  };

  const setViewportTransform = ({
    stagePos: nextStagePos,
    stageScale: nextStageScale,
  }: {
    stagePos: Point;
    stageScale?: number;
  }) => {
    setStagePos(nextStagePos);
    if (typeof nextStageScale === 'number') {
      setStageScale(nextStageScale);
    }
  };

  const { handlePointerDown, handlePointerMove, handlePointerUp } = createBoardPointerHandlers({
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
  });

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const pointer = getCanvasPointFromClient(event.clientX, event.clientY);
    const surface = surfaceRef.current;
    if (!pointer || !surface) return;

    if (event.ctrlKey) {
      const nextScale = clampStageScale(
        event.deltaY > 0 ? stageScale / 1.05 : stageScale * 1.05
      );
      setStageScale(nextScale);
      const surfaceRect = surface.getBoundingClientRect();
      setStagePos({
        ...getPointerAnchoredStagePosition(
          {
            x: event.clientX - surfaceRect.left,
            y: event.clientY - surfaceRect.top,
          },
          pointer,
          nextScale
        ),
      });
      return;
    }

    setStagePos((previous) => ({
      x: previous.x - event.deltaX,
      y: previous.y - event.deltaY,
    }));
  };

  const handleUndo = () => {
    commitUndo(commitContext, { applyUndo });
  };

  const handleRedo = () => {
    commitRedo(commitContext, { applyRedo });
  };

  const handleClear = () => {
    commitClear(commitContext, { applyErase }, currentLayerShapes);
  };

  const zoomAroundViewportCenter = (nextScale: number) => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const rect = surface.getBoundingClientRect();
    const scenePoint = getViewportCenterScenePoint(
      { width: rect.width, height: rect.height },
      stagePos,
      stageScale
    );

    setStageScale(nextScale);
    setStagePos(
      getCenteredStagePosition(
        { width: rect.width, height: rect.height },
        scenePoint,
        nextScale
      )
    );
  };

  const handleZoomIn = () => zoomAroundViewportCenter(clampStageScale(stageScale * 1.1));
  const handleZoomOut = () => zoomAroundViewportCenter(clampStageScale(stageScale / 1.1));
  const handleResetZoom = () => {
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  return {
    stageScale,
    stagePos,
    surfaceRef,
    canvasRef,
    stageRef,
    isDrawing,
    currentPoints,
    erasingPreview,
    isSpacePressed,
    isAltPressed,
    isRightMousePressed,
    isPanning,
    editingMarkdown,
    setEditingMarkdown,
    selectedIds,
    selectionRect,
    selectionLassoPoints,
    selectionBounds,
    selectionDisplayBounds,
    selectionRotationDegrees,
    renderShapes,
    currentLayerShapes: currentLayerDisplayShapes,
    selectedShapes,
    handleMarkdownContentChange,
    handleSaveMarkdown,
    replaceSelection,
    handleUndo,
    handleRedo,
    handleClear,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    getCanvasPointFromClient,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    cancelActiveInteraction,
    setViewportTransform,
  };
};
