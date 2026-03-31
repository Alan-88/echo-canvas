import type { Action } from '../types';

const getActiveLastAction = (
  history: Action[],
  pointer: number
): Action | null => {
  if (pointer <= 0 || pointer > history.length) return null;
  return history[pointer - 1];
};

const normalizeIds = (ids: string[]) => ids.slice().sort().join(',');
const normalizeOrderIds = (ids: string[]) => ids.join('>');

const hasActiveDrawWithSameId = (
  history: Action[],
  pointer: number,
  drawId: string
) => {
  const activeLength = Math.max(0, Math.min(pointer, history.length));

  for (let index = 0; index < activeLength; index += 1) {
    const action = history[index];
    if (action.type === 'draw' && action.payload.id === drawId) {
      return true;
    }
  }

  return false;
};

export const isDuplicateDrawActionAtPointer = (
  history: Action[],
  pointer: number,
  action: Extract<Action, { type: 'draw' }>
) => {
  return hasActiveDrawWithSameId(history, pointer, action.payload.id);
};

export const isDuplicateEraseActionAtPointer = (
  history: Action[],
  pointer: number,
  action: Extract<Action, { type: 'erase' }>
) => {
  const lastAction = getActiveLastAction(history, pointer);
  if (!lastAction || lastAction.type !== 'erase') return false;
  return (
    normalizeIds(lastAction.payload.shapeIds) ===
      normalizeIds(action.payload.shapeIds) &&
    Boolean(lastAction.payload.forceAllTypes) ===
      Boolean(action.payload.forceAllTypes)
  );
};

export const isDuplicateReorderActionAtPointer = (
  history: Action[],
  pointer: number,
  action: Extract<Action, { type: 'reorder' }>
) => {
  const lastAction = getActiveLastAction(history, pointer);
  if (!lastAction || lastAction.type !== 'reorder') return false;
  return (
    normalizeOrderIds(lastAction.payload.orderedIds) ===
    normalizeOrderIds(action.payload.orderedIds)
  );
};
