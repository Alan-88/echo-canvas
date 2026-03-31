import { useCallback } from 'react';
import type { ShapeData } from '../types';
import { exportSelectionAsPng } from '../features/canvas-overlay/utils/selectionExport';
import {
  DEFAULT_EXPORT_BACKGROUND,
  DEFAULT_EXPORT_EMPTY_SIZE,
  DEFAULT_EXPORT_MAX_PIXELS,
  DEFAULT_EXPORT_PADDING,
} from '../utils/exportPngPolicy';

interface ShapeWithId {
  id: string;
  shape: ShapeData;
}

interface UseWhiteboardExportActionsParams {
  layerIds: string[];
  allVisibleShapes: Record<string, ShapeWithId[]>;
}

const collectVisibleShapesInLayerOrder = (
  layerIds: string[],
  allVisibleShapes: Record<string, ShapeWithId[]>
): ShapeWithId[] => {
  const ordered: ShapeWithId[] = [];

  layerIds.forEach((layerId) => {
    const shapes = allVisibleShapes[layerId] || [];
    shapes.forEach((shape) => {
      ordered.push(shape);
    });
  });

  return ordered;
};

export const useWhiteboardExportActions = ({
  layerIds,
  allVisibleShapes,
}: UseWhiteboardExportActionsParams) => {
  const handleExportPNG = useCallback(() => {
    const shapes = collectVisibleShapesInLayerOrder(layerIds, allVisibleShapes);
    void (async () => {
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
        alert('导出失败，请重试。');
      }
    })();
  }, [
    allVisibleShapes,
    layerIds,
  ]);

  return {
    handleExportPNG,
  };
};
