import type React from 'react';
import type { Point } from './shapeGeometry';

export const collectDrawSamplePoints = (
  event: React.PointerEvent<HTMLDivElement>,
  getCanvasPointFromClient: (clientX: number, clientY: number) => Point | null
) => {
  const nativeEvent = event.nativeEvent;
  const coalescedEvents =
    typeof nativeEvent.getCoalescedEvents === 'function'
      ? nativeEvent.getCoalescedEvents()
      : [];
  const sourceEvents = coalescedEvents.length > 0 ? coalescedEvents : [nativeEvent];
  const samples: Point[] = [];

  sourceEvents.forEach((sample) => {
    const point = getCanvasPointFromClient(sample.clientX, sample.clientY);
    if (point) {
      samples.push(point);
    }
  });

  return samples;
};

export const appendDrawSamples = (existingPoints: number[], samples: Point[]) => {
  if (samples.length === 0) {
    return existingPoints;
  }

  let nextPoints: number[] | null = null;
  let lastX = existingPoints.length >= 2 ? existingPoints[existingPoints.length - 2] : null;
  let lastY = existingPoints.length >= 2 ? existingPoints[existingPoints.length - 1] : null;

  samples.forEach((sample) => {
    if (
      lastX !== null &&
      lastY !== null &&
      Math.abs(sample.x - lastX) < 0.01 &&
      Math.abs(sample.y - lastY) < 0.01
    ) {
      return;
    }

    if (!nextPoints) {
      nextPoints = [...existingPoints];
    }
    nextPoints.push(sample.x, sample.y);
    lastX = sample.x;
    lastY = sample.y;
  });

  return nextPoints ?? existingPoints;
};
