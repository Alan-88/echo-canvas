import React, { useMemo } from 'react';
import type { Bounds, Point, ShapeWithId } from '../utils/shapeGeometry';
import {
  getDefaultResizeCursor,
  getEnabledResizeHandles,
  getHandlePositions,
} from '../utils/selectionResize';
import {
  canRotateSelection,
  getRotationHandlePosition,
} from '../utils/selectionRotate';
import { toLassoPath } from '../utils/selectionLasso';

interface SelectionOverlayProps {
  selectionRect: Bounds | null;
  selectionLassoPoints: Point[] | null;
  selectionBounds: Bounds | null;
  selectionDisplayBounds: Bounds | null;
  selectionRotationDegrees: number;
  stageScale: number;
  selectedShapes: ShapeWithId[];
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  selectionRect,
  selectionLassoPoints,
  selectionBounds,
  selectionDisplayBounds,
  selectionRotationDegrees,
  stageScale,
  selectedShapes,
}) => {
  const handles = useMemo(
    () => (selectionDisplayBounds ? getEnabledResizeHandles(selectedShapes) : []),
    [selectedShapes, selectionDisplayBounds]
  );
  const positions = useMemo(
    () => (selectionDisplayBounds ? getHandlePositions(selectionDisplayBounds, handles) : []),
    [handles, selectionDisplayBounds]
  );
  const showRotationHandle = useMemo(
    () => (selectionDisplayBounds ? canRotateSelection(selectedShapes) : false),
    [selectedShapes, selectionDisplayBounds]
  );
  const rotationHandle = useMemo(
    () =>
      selectionDisplayBounds && showRotationHandle
        ? getRotationHandlePosition(selectionDisplayBounds)
        : null,
    [selectionDisplayBounds, showRotationHandle]
  );
  const lassoPath = useMemo(
    () => (selectionLassoPoints && selectionLassoPoints.length >= 2 ? toLassoPath(selectionLassoPoints) : ''),
    [selectionLassoPoints]
  );
  const handleSize = 12 / Math.max(stageScale, 0.25);
  const handleRadius = handleSize / 2;

  return (
    <>
      {lassoPath && (
        <svg className="absolute inset-0 overflow-visible pointer-events-none">
          <path
            d={lassoPath}
            fill="rgba(75, 123, 245, 0.12)"
            stroke="#4B7BF5"
            strokeWidth={1 / Math.max(stageScale, 0.25)}
            strokeDasharray={`${6 / Math.max(stageScale, 0.25)} ${4 / Math.max(stageScale, 0.25)}`}
            strokeLinejoin="round"
          />
        </svg>
      )}

      {selectionRect && (
        <div
          className="absolute border border-dashed border-[#4B7BF5] bg-[#4B7BF5]/10"
          style={{
            left: `${selectionRect.x}px`,
            top: `${selectionRect.y}px`,
            width: `${selectionRect.width}px`,
            height: `${selectionRect.height}px`,
          }}
        />
      )}

      {selectionBounds && selectionDisplayBounds && (
        <>
          <div
            className="absolute"
            style={{
              left: `${selectionDisplayBounds.x}px`,
              top: `${selectionDisplayBounds.y}px`,
              width: `${selectionDisplayBounds.width}px`,
              height: `${selectionDisplayBounds.height}px`,
              transform: `rotate(${selectionRotationDegrees}deg)`,
              transformOrigin: 'center center',
            }}
          >
            <div className="absolute inset-0 border border-[#4B7BF5] bg-[#4B7BF5]/[0.04]" />
            {positions.map((position) => (
              <div
                key={position.handle}
                className="absolute rounded-full border border-white bg-[#4B7BF5] shadow"
                style={{
                  width: `${handleSize}px`,
                  height: `${handleSize}px`,
                  left: `${position.x - selectionDisplayBounds.x - handleRadius}px`,
                  top: `${position.y - selectionDisplayBounds.y - handleRadius}px`,
                  cursor: getDefaultResizeCursor(position.handle),
                }}
              />
            ))}

            {rotationHandle && (
              <>
                <div
                  className="absolute w-px bg-[#4B7BF5]/70"
                  style={{
                    left: `${rotationHandle.anchorX - selectionDisplayBounds.x}px`,
                    top: `${rotationHandle.y - selectionDisplayBounds.y}px`,
                    height: `${rotationHandle.anchorY - rotationHandle.y}px`,
                  }}
                />
                <div
                  className="absolute rounded-full border border-white bg-white shadow"
                  style={{
                    width: `${handleSize}px`,
                    height: `${handleSize}px`,
                    left: `${rotationHandle.x - selectionDisplayBounds.x - handleRadius}px`,
                    top: `${rotationHandle.y - selectionDisplayBounds.y - handleRadius}px`,
                    cursor: 'grab',
                  }}
                />
              </>
            )}
          </div>
        </>
      )}
    </>
  );
};
