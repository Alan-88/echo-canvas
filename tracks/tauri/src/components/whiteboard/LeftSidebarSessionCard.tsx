import React from 'react';
import { Copy, Info } from 'lucide-react';
import {
  getRoomSessionMode,
  getSaveStateLabel,
  type SaveState,
} from '../../utils/roomSessionMode';

interface LeftSidebarSessionCardProps {
  roomId: string;
  tokenState: SaveState;
  savedToken: string | null;
  onCopyRoomId: () => void;
  onCopyToken: () => void;
}

const formatRoomId = (id: string) => {
  const parts = id.match(/.{1,4}/g);
  return parts ? parts.join('-') : id;
};

const formatToken = (token: string) => {
  if (token.length <= 12) return token;
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
};

const getStatusClasses = (tokenState: SaveState) =>
  tokenState === 'synced'
    ? 'bg-green-50 text-green-600'
    : tokenState === 'syncing'
      ? 'bg-blue-50 text-blue-600'
      : 'bg-cream text-[#FA6400]';

const getStatusDotClasses = (tokenState: SaveState) =>
  tokenState === 'synced'
    ? 'bg-green-500'
    : tokenState === 'syncing'
      ? 'bg-blue-500'
      : 'bg-[#FA6400]';

export const LeftSidebarSessionCard: React.FC<LeftSidebarSessionCardProps> = ({
  roomId,
  tokenState,
  savedToken,
  onCopyRoomId,
  onCopyToken,
}) => {
  const mode = getRoomSessionMode(roomId);

  if (mode === 'local') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lavender">
          <Info className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">LOCAL BOARD</span>
        </div>

        <div className="bg-input rounded-2xl p-4 border border-transparent transition-all duration-300">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="text-[10px] text-lavender font-bold uppercase">Snapshot</div>
              <div className="mt-1 text-sm font-black text-ink">Single-player Save</div>
            </div>
            <div
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${getStatusClasses(tokenState)}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotClasses(tokenState)}`} />
              {getSaveStateLabel(mode, tokenState)}
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-lavender">
            当前白板会保存到本机 App 数据目录，下次启动会自动恢复。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lavender">
        <Info className="w-4 h-4" />
        <span className="text-xs font-black uppercase tracking-widest">SESSION INFO</span>
      </div>

      <div className="bg-input rounded-2xl p-4 flex items-center justify-between border border-transparent hover:border-[#E0D8F0] transition-colors group">
        <div>
          <div className="text-[10px] text-lavender font-bold uppercase mb-1">Room ID</div>
          <div className="font-black text-ink text-lg font-mono">
            {formatRoomId(roomId)}
          </div>
        </div>
        <button
          onClick={onCopyRoomId}
          className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-lavender hover:text-ink shadow-sm transition-colors"
          title="Copy Room ID"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-input rounded-2xl p-4 border border-transparent transition-all duration-300">
        <div className="flex justify-between items-start mb-1">
          <div className="text-[10px] text-lavender font-bold uppercase">Token</div>
          <div
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${getStatusClasses(tokenState)}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotClasses(tokenState)}`} />
            {getSaveStateLabel(mode, tokenState)}
          </div>
        </div>

        {savedToken ? (
          <div className="mt-2">
            <div className="font-mono text-xs text-ink break-all bg-white p-2 rounded-lg border border-[#E0D8F0]">
              {formatToken(savedToken)}
            </div>
            <button
              onClick={onCopyToken}
              className="mt-2 w-full py-1.5 bg-ink text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
            >
              Copy Token
            </button>
          </div>
        ) : (
          <div className="text-xs text-lavender italic mt-1">Sync to generate key</div>
        )}
      </div>
    </div>
  );
};
