import type { MutableRefObject } from 'react';
import type { ShapeData } from '../../../types';
import type { CommitContext, ShapeCommitStoreActions } from './boardActions';
import { commitShapeUpdates } from './boardActions';
import { mapShapesWithPreview } from './selectionPreviewShapes';
import type { SelectionTransformState } from './selectionTransformSession';

export const commitSelectionTransformInteraction = async ({
  interaction,
  previewShapesRef,
  context,
  storeActions,
}: {
  interaction: SelectionTransformState;
  previewShapesRef: MutableRefObject<Map<string, ShapeData>>;
  context: CommitContext;
  storeActions: ShapeCommitStoreActions;
}) => {
  const updates = mapShapesWithPreview(interaction.initialShapes, previewShapesRef.current);
  await commitShapeUpdates(context, storeActions, updates, interaction.initialShapes);
};
