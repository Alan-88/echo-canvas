import type { Point } from './shapeGeometry';

export const clampStageScale = (value: number) => Math.max(0.1, Math.min(10, value));

export const getViewportCenterScenePoint = (
  viewportSize: { width: number; height: number },
  stagePos: Point,
  stageScale: number
): Point => ({
  x: (viewportSize.width / 2 - stagePos.x) / stageScale,
  y: (viewportSize.height / 2 - stagePos.y) / stageScale,
});

export const getPointerAnchoredStagePosition = (
  clientPoint: Point,
  scenePoint: Point,
  nextScale: number
): Point => ({
  x: clientPoint.x - scenePoint.x * nextScale,
  y: clientPoint.y - scenePoint.y * nextScale,
});

export const getCenteredStagePosition = (
  viewportSize: { width: number; height: number },
  scenePoint: Point,
  nextScale: number
): Point => ({
  x: viewportSize.width / 2 - scenePoint.x * nextScale,
  y: viewportSize.height / 2 - scenePoint.y * nextScale,
});
