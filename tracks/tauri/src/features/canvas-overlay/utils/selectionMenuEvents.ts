export type SelectionMenuAction =
  | 'copy'
  | 'paste'
  | 'delete'
  | 'export-png'
  | 'export-json'
  | 'export-latex';

export const CANVAS_SELECTION_MENU_ACTION_EVENT = 'canvasOverlaySelectionMenuAction';

export const dispatchCanvasSelectionMenuAction = (action: SelectionMenuAction) => {
  window.dispatchEvent(
    new CustomEvent(CANVAS_SELECTION_MENU_ACTION_EVENT, {
      detail: { action },
    })
  );
};
