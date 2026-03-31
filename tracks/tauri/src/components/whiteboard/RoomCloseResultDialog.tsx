import React from 'react';
import { Check, Copy, DoorClosed, X } from 'lucide-react';

interface RoomCloseResultDialogProps {
  isOpen: boolean;
  message: string;
  restoreToken: string;
  tokenCopied: boolean;
  onCopyToken: () => void;
  onClose: () => void;
}

const formatToken = (token: string) => {
  if (token.length <= 20) return token;
  return `${token.slice(0, 16)}...${token.slice(-8)}`;
};

export const RoomCloseResultDialog: React.FC<RoomCloseResultDialogProps> = ({
  isOpen,
  message,
  restoreToken,
  tokenCopied,
  onCopyToken,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/35 backdrop-blur-sm">
      <div
        className="w-[520px] max-w-[92vw] overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl"
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        <div className="flex items-center justify-between border-b border-[#E0D8F0] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
              <DoorClosed className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="text-lg font-black text-[#342E55]">Room Closed</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#827BB9] transition-colors hover:bg-[#F5F0FF] hover:text-[#342E55]"
            title="Back to Lobby"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-6">
          <p className="text-base leading-relaxed text-[#342E55]">
            {message}
          </p>

          <div className="rounded-2xl border border-green-200 bg-green-50/70 p-4">
            <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-green-700">
              Restore Token
            </div>
            <div className="rounded-xl border border-green-100 bg-white px-3 py-3 font-mono text-sm text-[#342E55] break-all">
              {formatToken(restoreToken)}
            </div>
            <p className="mt-3 text-sm text-green-800">
              关闭后无法再从当前页面查看。返回大厅前请先复制。
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#E0D8F0] bg-[#F5F0FF]/30 px-6 py-4">
          <button
            onClick={onCopyToken}
            className="flex items-center gap-2 rounded-xl border border-[#E0D8F0] bg-white px-5 py-2.5 text-sm font-bold text-[#342E55] transition-colors hover:border-green-300 hover:text-green-700"
          >
            {tokenCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {tokenCopied ? 'Copied' : 'Copy Token'}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-[#342E55] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Back to Lobby
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
