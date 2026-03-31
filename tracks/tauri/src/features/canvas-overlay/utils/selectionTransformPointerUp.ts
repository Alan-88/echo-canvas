import type { MutableRefObject } from 'react';
import type { ShapeData } from '../../../types';
import type { CommitContext, ShapeCommitStoreActions } from './boardActions';
import { commitSelectionTransformInteraction } from './selectionTransformCommit';
import type { SelectionTransformState } from './selectionTransformSession';

export const finalizeSelectionTransformPointerUp = async ({
  interaction,
  interactionRef,
  previewShapesRef,
  context,
  storeActions,
  resetSelectionTransient,
}: {
  interaction: SelectionTransformState;
  interactionRef: MutableRefObject<{ kind: string }>;
  previewShapesRef: MutableRefObject<Map<string, ShapeData>>;
  context: CommitContext;
  storeActions: ShapeCommitStoreActions;
  resetSelectionTransient: (options?: { clearMarquee?: boolean }) => void;
}) => {
  interactionRef.current = { kind: 'idle' };

  try {
    await commitSelectionTransformInteraction({
      interaction,
      previewShapesRef,
      context,
      storeActions,
    });
  } finally {
    resetSelectionTransient({ clearMarquee: false });
  }
};
