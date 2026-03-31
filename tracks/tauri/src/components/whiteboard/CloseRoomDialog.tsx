import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface CloseRoomDialogProps {
  isOpen: boolean;
  onSaveAndClose: () => void;
  onCloseWithoutSave: () => void;
  onCancel: () => void;
}

export const CloseRoomDialog: React.FC<CloseRoomDialogProps> = ({
  isOpen,
  onSaveAndClose,
  onCloseWithoutSave,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100]"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-white/50 w-[480px] max-w-[90vw] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E0D8F0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="font-black text-[#342E55] text-lg">Close Room?</h3>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg hover:bg-[#F5F0FF] text-[#827BB9] hover:text-[#342E55] flex items-center justify-center transition-colors"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-[#342E55] text-base leading-relaxed mb-4">
            This will permanently close the room and disconnect all participants.
          </p>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2 mb-4">
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <p className="text-sm text-red-700">
                <span className="font-bold">All unsaved changes will be lost</span>
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <p className="text-sm text-red-700">
                All users will be disconnected immediately
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <p className="text-sm text-red-700">
                This action cannot be undone
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#E0D8F0] bg-[#F5F0FF]/40 p-4 text-sm text-[#342E55] space-y-2">
            <p className="font-bold">Choose how to close:</p>
            <p>
              <span className="font-bold">Save & Close</span> will generate or reuse a restore token before leaving.
            </p>
            <p>
              <span className="font-bold">Close Without Saving</span> will unload the room immediately and keep no new token.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F5F0FF]/30 border-t border-[#E0D8F0] flex flex-wrap justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl text-[#827BB9] hover:text-[#342E55] hover:bg-white font-bold text-sm transition-colors border border-transparent hover:border-[#E0D8F0]"
          >
            Cancel
          </button>
          <button
            onClick={onCloseWithoutSave}
            className="px-6 py-2.5 rounded-xl border border-red-200 bg-white text-red-500 hover:bg-red-50 font-bold text-sm transition-colors shadow-sm"
          >
            Close Without Saving
          </button>
          <button
            onClick={onSaveAndClose}
            className="px-6 py-2.5 rounded-xl bg-[#342E55] text-white hover:opacity-90 font-bold text-sm transition-opacity shadow-sm"
          >
            Save & Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
