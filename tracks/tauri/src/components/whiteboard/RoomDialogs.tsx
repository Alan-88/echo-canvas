import React from 'react';
import { CloseRoomDialog } from './CloseRoomDialog';
import { RoomCloseResultDialog } from './RoomCloseResultDialog';
import type { CloseResultState } from '../../hooks/useCloseRoomState';

interface RoomDialogsProps {
  closeDialogOpen: boolean;
  onCancelClose: () => void;
  onSaveAndClose: () => void;
  onCloseWithoutSave: () => void;
  closeResult: CloseResultState | null;
  closeResultCopied: boolean;
  onCopyCloseResultToken: () => void;
  onDismissCloseResult: () => void;
}

export const RoomDialogs: React.FC<RoomDialogsProps> = ({
  closeDialogOpen,
  onCancelClose,
  onSaveAndClose,
  onCloseWithoutSave,
  closeResult,
  closeResultCopied,
  onCopyCloseResultToken,
  onDismissCloseResult,
}) => {
  return (
    <>
      <CloseRoomDialog
        isOpen={closeDialogOpen}
        onSaveAndClose={onSaveAndClose}
        onCloseWithoutSave={onCloseWithoutSave}
        onCancel={onCancelClose}
      />

      <RoomCloseResultDialog
        isOpen={closeResult !== null}
        message={closeResult?.message || ''}
        restoreToken={closeResult?.restoreToken || ''}
        tokenCopied={closeResultCopied}
        onCopyToken={onCopyCloseResultToken}
        onClose={onDismissCloseResult}
      />
    </>
  );
};
