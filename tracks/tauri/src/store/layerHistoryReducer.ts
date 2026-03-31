import type { Action, ShapeData } from '../types';
import {
  normalizeEraseShapeIds,
  orderShapesByVisualLayer,
} from '../utils/shapePolicy';

interface ShapeWithId {
  id: string;
  shape: ShapeData;
}

const reorderShapesByIds = (
  shapes: ShapeWithId[],
  orderedIds: string[]
): ShapeWithId[] => {
  if (orderedIds.length === 0 || shapes.length <= 1) return shapes;

  const byId = new Map(shapes.map((shape) => [shape.id, shape] as const));
  const seen = new Set<string>();
  const reordered: ShapeWithId[] = [];

  orderedIds.forEach((id) => {
    if (seen.has(id)) return;
    const shape = byId.get(id);
    if (!shape) return;
    seen.add(id);
    reordered.push(shape);
  });

  shapes.forEach((shape) => {
    if (!seen.has(shape.id)) {
      reordered.push(shape);
    }
  });

  return reordered;
};

const normalizeShapeData = (shape: ShapeData): ShapeData => {
  if (shape.type === 'line') {
    return {
      type: 'line',
      data: {
        ...shape.data,
        x: shape.data.x ?? 0,
        y: shape.data.y ?? 0,
        rotation: shape.data.rotation ?? 0,
        scaleX: shape.data.scaleX ?? 1,
        scaleY: shape.data.scaleY ?? 1,
      },
    };
  }

  if (shape.type === 'image') {
    return {
      type: 'image',
      data: {
        ...shape.data,
        rotation: shape.data.rotation ?? 0,
        scaleX: shape.data.scaleX ?? 1,
        scaleY: shape.data.scaleY ?? 1,
      },
    };
  }

  if (shape.type === 'markdown') {
    return {
      type: 'markdown',
      data: {
        ...shape.data,
        rotation: shape.data.rotation ?? 0,
        scaleX: shape.data.scaleX ?? 1,
        scaleY: shape.data.scaleY ?? 1,
      },
    };
  }

  return {
    type: 'rect',
    data: {
      ...shape.data,
      rotation: shape.data.rotation ?? 0,
      scaleX: shape.data.scaleX ?? 1,
      scaleY: shape.data.scaleY ?? 1,
    },
  };
};

export const rebuildVisibleLayerShapes = (
  history: Action[],
  pointer: number
): ShapeWithId[] => {
  const shapes: ShapeWithId[] = [];

  for (let index = 0; index < pointer; index += 1) {
    const action = history[index];

    if (action.type === 'draw') {
      shapes.push({
        id: action.payload.id,
        shape: normalizeShapeData(action.payload.shape),
      });
      continue;
    }

    if (action.type === 'erase') {
      const idsToRemove = new Set(
        normalizeEraseShapeIds(
          action.payload.shapeIds,
          shapes,
          action.payload.forceAllTypes
        )
      );
      const filteredShapes = shapes.filter((shape) => !idsToRemove.has(shape.id));
      shapes.length = 0;
      shapes.push(...filteredShapes);
      continue;
    }

    if (action.type === 'update') {
      const targetIndex = shapes.findIndex((shape) => shape.id === action.payload.id);
      if (targetIndex !== -1) {
        shapes[targetIndex] = {
          id: action.payload.id,
          shape: normalizeShapeData(action.payload.newShape),
        };
      }
      continue;
    }

    if (action.type === 'batchUpdate') {
      action.payload.updates.forEach((update) => {
        const targetIndex = shapes.findIndex((shape) => shape.id === update.id);
        if (targetIndex !== -1) {
          shapes[targetIndex] = {
            id: update.id,
            shape: normalizeShapeData(update.newShape),
          };
        }
      });
      continue;
    }

    if (action.type === 'reorder') {
      const reorderedShapes = reorderShapesByIds(shapes, action.payload.orderedIds);
      shapes.length = 0;
      shapes.push(...reorderedShapes);
      continue;
    }

    if (action.type === 'clear') {
      shapes.length = 0;
    }
  }

  return orderShapesByVisualLayer(shapes);
};
