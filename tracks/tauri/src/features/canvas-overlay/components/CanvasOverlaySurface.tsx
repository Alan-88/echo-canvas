import React, { useEffect, useMemo, useRef } from 'react';
import { renderScene, getCanvasSceneShapes } from '../utils/sceneRenderer';
import type { CanvasOverlayBoardState } from '../hooks/useCanvasOverlayBoard';
import { SelectionOverlay } from './SelectionOverlay';
import { SelectionContextMenuCard } from './SelectionContextMenuCard';
import { useSelectionContextMenu } from '../hooks/useSelectionContextMenu';
import {
  dispatchCanvasSelectionMenuAction,
  type SelectionMenuAction,
} from '../utils/selectionMenuEvents';
import { buildMarkdownLatexContentFromSelection } from '../utils/selectionExport';
import { hitTestShapes } from '../utils/shapeGeometry';
import { hitTestSelectionInterior } from '../utils/selectionFrame';
import {
  getMarkdownLayoutHeight,
  getMarkdownLayoutWidth,
} from '../../../utils/markdownShapePersistence';
import { useCanvasOverlayRasterAssets } from '../hooks/useCanvasOverlayRasterAssets';
import { useTouchViewportGestures } from '../hooks/useTouchViewportGestures';
import { MarkdownOverlayLayer } from './MarkdownOverlayLayer';

type Tool = 'pen' | 'eraser' | 'select' | 'pan';

interface CanvasOverlaySurfaceProps {
  board: CanvasOverlayBoardState;
  effectiveTool: Tool;
  stylusModeEnabled: boolean;
  penConfig: { color: string; size: number };
  cursor: string;
  onEditMarkdown: (data: {
    id: string;
    content: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}

export const CanvasOverlaySurface: React.FC<CanvasOverlaySurfaceProps> = ({
  board,
  effectiveTool,
  stylusModeEnabled,
  penConfig,
  cursor,
  onEditMarkdown,
}) => {
  const activePointerToolRef = useRef<Tool | null>(null);
  const capturedPointerIdRef = useRef<number | null>(null);
  const ignoreNativeContextMenuUntilRef = useRef(0);
  const markdownTapCandidateRef = useRef<{
    pointerId: number;
    shapeId: string;
    wasSoleSelected: boolean;
    moved: boolean;
  } | null>(null);
  const { menu, openMenu, closeMenu } = useSelectionContextMenu();
  const touchViewportGestures = useTouchViewportGestures({
    board,
    stylusModeEnabled,
    activePointerToolRef,
    onEditMarkdown,
    startBoardSelectionInteraction: (event) => {
      board.handlePointerDown(
        event as React.PointerEvent<HTMLDivElement>,
        'select'
      );
    },
    moveBoardSelectionInteraction: (event) => {
      board.handlePointerMove(
        event as React.PointerEvent<HTMLDivElement>,
        'select'
      );
    },
    endBoardSelectionInteraction: (event) => {
      board.handlePointerUp(
        event as React.PointerEvent<HTMLDivElement>,
        'select'
      );
    },
    openContextMenu: ({ clientX, clientY, kind }) => {
      const surface = board.surfaceRef.current;
      if (!surface) return;
      ignoreNativeContextMenuUntilRef.current = Date.now() + 1000;
      openMenu({
        clientX,
        clientY,
        containerRect: surface.getBoundingClientRect(),
        kind,
      });
    },
  });

  const canvasShapes = useMemo(
    () =>
      getCanvasSceneShapes(
        board.renderShapes.filter(
          (shape) =>
            shape.id !== board.editingMarkdown?.id && shape.shape.type !== 'markdown'
        )
      ),
    [board.editingMarkdown?.id, board.renderShapes]
  );
  const rasterShapes = useMemo(
    () => canvasShapes.filter((shape) => shape.shape.type === 'image'),
    [canvasShapes]
  );
  const { imageCache, imageVersion } = useCanvasOverlayRasterAssets(rasterShapes);
  const canCreateLatexTextBox = useMemo(
    () => Boolean(buildMarkdownLatexContentFromSelection(board.selectedShapes)),
    [board.selectedShapes]
  );
  const selectionOverlayVisible = !board.editingMarkdown;

  useEffect(() => {
    const canvas = board.canvasRef.current;
    if (!canvas) return;

    renderScene({
      canvas,
      stageScale: board.stageScale,
      stagePos: board.stagePos,
      shapes: canvasShapes,
      draftLinePoints: board.currentPoints,
      penColor: penConfig.color,
      penSize: penConfig.size,
      erasingPreview: board.erasingPreview,
      imageCache,
    });
  }, [
    board.canvasRef,
    board.currentPoints,
    board.erasingPreview,
    board.stagePos,
    board.stageScale,
    canvasShapes,
    imageCache,
    imageVersion,
    penConfig.color,
    penConfig.size,
  ]);

  useEffect(() => {
    const surface = board.surfaceRef.current;
    if (!surface) return;

    const preventGestureZoom = (event: Event) => {
      event.preventDefault();
    };
    const preventBrowserCtrlWheelZoom = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    surface.addEventListener('gesturestart', preventGestureZoom, { passive: false });
    surface.addEventListener('gesturechange', preventGestureZoom, { passive: false });
    surface.addEventListener('gestureend', preventGestureZoom, { passive: false });
    surface.addEventListener('wheel', preventBrowserCtrlWheelZoom, { passive: false });

    return () => {
      surface.removeEventListener('gesturestart', preventGestureZoom);
      surface.removeEventListener('gesturechange', preventGestureZoom);
      surface.removeEventListener('gestureend', preventGestureZoom);
      surface.removeEventListener('wheel', preventBrowserCtrlWheelZoom);
    };
  }, [board.surfaceRef]);

  const handleSelectionMenuAction = (action: SelectionMenuAction) => {
    dispatchCanvasSelectionMenuAction(action);
    closeMenu();
  };

  const resolvePointerDownTool = (event: React.PointerEvent<HTMLDivElement>): Tool => {
    if (stylusModeEnabled && event.pointerType === 'touch') {
      return 'pan';
    }
    if (event.button === 2 && effectiveTool === 'pen') {
      return 'eraser';
    }
    return effectiveTool;
  };

  return (
    <div
      ref={board.surfaceRef}
      data-whiteboard-surface="true"
      className="absolute inset-0 overflow-hidden"
      style={{ cursor, touchAction: 'none' }}
      onPointerDown={(event) => {
        closeMenu();
        if (touchViewportGestures.handlePointerDown(event)) {
          return;
        }
        const isSelectionContextClick =
          event.button === 2 && effectiveTool === 'select' && board.selectedShapes.length > 0;
        if (isSelectionContextClick) {
          return;
        }
        if (effectiveTool === 'select' && event.button === 0 && event.pointerType !== 'touch') {
          const point = board.getCanvasPointFromClient(event.clientX, event.clientY);
          const hitShape = point
            ? hitTestShapes(
                board.currentLayerShapes,
                point,
                6 / Math.max(board.stageScale, 0.5)
              )
            : null;
          markdownTapCandidateRef.current =
            hitShape?.shape.type === 'markdown'
              ? {
                  pointerId: event.pointerId,
                  shapeId: hitShape.id,
                  wasSoleSelected:
                    board.selectedIds.length === 1 && board.selectedIds[0] === hitShape.id,
                  moved: false,
                }
              : null;
        } else {
          markdownTapCandidateRef.current = null;
        }
        const pointerTool = resolvePointerDownTool(event);
        activePointerToolRef.current = pointerTool;
        if (pointerTool === 'pen' || pointerTool === 'eraser') {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
            capturedPointerIdRef.current = event.pointerId;
          } catch {
            capturedPointerIdRef.current = null;
          }
        }
        board.handlePointerDown(event, pointerTool);
      }}
      onPointerMove={(event) => {
        if (touchViewportGestures.handlePointerMove(event)) {
          return;
        }
        if (
          markdownTapCandidateRef.current &&
          markdownTapCandidateRef.current.pointerId === event.pointerId
        ) {
          markdownTapCandidateRef.current.moved = true;
        }
        board.handlePointerMove(event, activePointerToolRef.current || effectiveTool);
      }}
      onPointerUp={(event) => {
        if (touchViewportGestures.handlePointerUp(event)) {
          activePointerToolRef.current = null;
          return;
        }
        board.handlePointerUp(event, activePointerToolRef.current || effectiveTool);
        if (capturedPointerIdRef.current === event.pointerId) {
          try {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          } catch {
            // Ignore browsers that throw during capture cleanup.
          }
          capturedPointerIdRef.current = null;
        }
        if (
          markdownTapCandidateRef.current &&
          markdownTapCandidateRef.current.pointerId === event.pointerId &&
          markdownTapCandidateRef.current.wasSoleSelected &&
          !markdownTapCandidateRef.current.moved
        ) {
          const shape = board.currentLayerShapes.find(
            (item) => item.id === markdownTapCandidateRef.current?.shapeId
          );
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
        }
        markdownTapCandidateRef.current = null;
        activePointerToolRef.current = null;
      }}
      onPointerCancel={(event) => {
        if (touchViewportGestures.handlePointerUp(event)) {
          activePointerToolRef.current = null;
          return;
        }
        board.handlePointerUp(event, activePointerToolRef.current || effectiveTool);
        if (capturedPointerIdRef.current === event.pointerId) {
          try {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          } catch {
            // Ignore browsers that throw during capture cleanup.
          }
          capturedPointerIdRef.current = null;
        }
        markdownTapCandidateRef.current = null;
        activePointerToolRef.current = null;
      }}
      onLostPointerCapture={(event) => {
        if (capturedPointerIdRef.current !== event.pointerId) return;
        capturedPointerIdRef.current = null;
      }}
      onWheel={board.handleWheel}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();

        if (Date.now() < ignoreNativeContextMenuUntilRef.current) {
          return;
        }

        if (effectiveTool !== 'select') {
          closeMenu();
          return;
        }

        const surface = board.surfaceRef.current;
        if (!surface) {
          closeMenu();
          return;
        }

        const point = board.getCanvasPointFromClient(event.clientX, event.clientY);
        if (!point) {
          closeMenu();
          return;
        }

        const hitShape = hitTestShapes(
          board.currentLayerShapes,
          point,
          6 / Math.max(board.stageScale, 0.5)
        );
        const insideSelection =
          board.selectedShapes.length > 0 &&
          hitTestSelectionInterior(
            point,
            board.selectionDisplayBounds,
            board.selectionRotationDegrees
          );

        if (insideSelection) {
          openMenu({
            clientX: event.clientX,
            clientY: event.clientY,
            containerRect: surface.getBoundingClientRect(),
            kind: 'selection',
          });
          return;
        }

        if (hitShape) {
          closeMenu();
          return;
        }

        openMenu({
          clientX: event.clientX,
          clientY: event.clientY,
          containerRect: surface.getBoundingClientRect(),
          kind: 'empty',
        });
      }}
      onDoubleClick={(event) => {
        if (effectiveTool !== 'select') return;

        const point = board.getCanvasPointFromClient(event.clientX, event.clientY);
        if (!point) return;

        const hitShape = hitTestShapes(
          board.currentLayerShapes,
          point,
          6 / Math.max(board.stageScale, 0.5)
        );
        if (!hitShape || hitShape.shape.type !== 'markdown') return;

        const markdownData = hitShape.shape.data;
        onEditMarkdown({
          id: hitShape.id,
          content: markdownData.content,
          x: markdownData.x,
          y: markdownData.y,
          width: getMarkdownLayoutWidth(markdownData),
          height: getMarkdownLayoutHeight(markdownData),
        });
      }}
    >
      <canvas ref={board.canvasRef} className="h-full w-full" />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${board.stagePos.x}px, ${board.stagePos.y}px) scale(${board.stageScale})`,
          transformOrigin: 'top left',
        }}
      >
        <MarkdownOverlayLayer
          shapes={board.renderShapes}
          selectedIds={board.selectedIds}
          editingMarkdownId={board.editingMarkdown?.id}
        />
        <SelectionOverlay
          selectionRect={selectionOverlayVisible ? board.selectionRect : null}
          selectionLassoPoints={selectionOverlayVisible ? board.selectionLassoPoints : null}
          selectionBounds={selectionOverlayVisible ? board.selectionBounds : null}
          selectionDisplayBounds={selectionOverlayVisible ? board.selectionDisplayBounds : null}
          selectionRotationDegrees={selectionOverlayVisible ? board.selectionRotationDegrees : 0}
          stageScale={board.stageScale}
          selectedShapes={selectionOverlayVisible ? board.selectedShapes : []}
        />
      </div>

      {menu && (
        <SelectionContextMenuCard
          menu={menu}
          canCreateLatexTextBox={canCreateLatexTextBox}
          onAction={handleSelectionMenuAction}
        />
      )}
    </div>
  );
};
