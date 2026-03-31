import type { ShapeData } from '../types';
import { exportSelectionAsPng } from '../features/canvas-overlay/utils/selectionExport';
import {
  DEFAULT_EXPORT_BACKGROUND,
  DEFAULT_EXPORT_EMPTY_SIZE,
  DEFAULT_EXPORT_MAX_PIXELS,
  DEFAULT_EXPORT_PADDING,
} from './exportPngPolicy';

interface ShapeWithId {
  id: string;
  shape: ShapeData;
}

const collectVisibleShapesInLayerOrder = (
  layerIds: string[],
  allVisibleShapes: Record<string, ShapeWithId[]>
): ShapeWithId[] => {
  const ordered: ShapeWithId[] = [];
  layerIds.forEach((layerId) => {
    const shapes = allVisibleShapes[layerId] || [];
    ordered.push(...shapes);
  });
  return ordered;
};

export const exportCanvasAsPNG = async (
  _stageRef: any,
  layerIds: string[],
  allVisibleShapes: Record<string, ShapeWithId[]>
): Promise<void> => {
  const shapes = collectVisibleShapesInLayerOrder(layerIds, allVisibleShapes);
  const success = await exportSelectionAsPng({
    shapes,
    fileNamePrefix: 'whiteboard',
    padding: DEFAULT_EXPORT_PADDING,
    backgroundColor: DEFAULT_EXPORT_BACKGROUND,
    maxPixels: DEFAULT_EXPORT_MAX_PIXELS,
    allowEmpty: true,
    emptySize: DEFAULT_EXPORT_EMPTY_SIZE,
  });

  if (!success) {
    throw new Error('导出失败');
  }
};
