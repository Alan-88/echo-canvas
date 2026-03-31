import type { ShapeData } from '../../../types';
import type { ShapeWithId } from './shapeGeometry';
import { orderShapesForSelectionDisplay } from './selectionState';

export interface SceneShapeWithStyle extends ShapeWithId {
  opacity: number;
}

interface BuildLayerSceneShapesOptions {
  allVisibleShapes: Record<string, ShapeWithId[]>;
  currentLayerId: string | null;
  previewShapes: Map<string, ShapeData>;
  selectedIds: string[];
  inactiveLayerOpacity?: number;
}

export const buildLayerSceneShapes = ({
  allVisibleShapes,
  currentLayerId,
  previewShapes,
  selectedIds,
  inactiveLayerOpacity = 0.32,
}: BuildLayerSceneShapesOptions): SceneShapeWithStyle[] =>
  Object.entries(allVisibleShapes).flatMap(([layerId, layerShapes]) => {
    const nextShapes = layerShapes.map((shapeWithId) => ({
      ...shapeWithId,
      shape:
        shapeWithId.id && previewShapes.has(shapeWithId.id)
          ? previewShapes.get(shapeWithId.id) || shapeWithId.shape
          : shapeWithId.shape,
    }));

    const orderedShapes =
      layerId === currentLayerId
        ? orderShapesForSelectionDisplay(nextShapes, selectedIds)
        : nextShapes;
    const opacity = layerId === currentLayerId ? 1 : inactiveLayerOpacity;

    return orderedShapes.map((shape) => ({
      ...shape,
      opacity,
    }));
  });
