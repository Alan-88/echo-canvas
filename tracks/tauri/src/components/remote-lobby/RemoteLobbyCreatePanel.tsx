import { ArrowRight } from 'lucide-react';

type RemoteLobbyCreatePanelProps = {
  onJoin: () => void;
};

export function RemoteLobbyCreatePanel({ onJoin }: RemoteLobbyCreatePanelProps) {
  return (
    <div className="max-w-xl">
      <div className="rounded-3xl border border-[#E0D8F0] bg-white p-6 space-y-3">
        <div className="text-sm font-bold text-ink">
          直接进入这个房间号。如果房间不存在，服务器会按原有逻辑创建新房间。
        </div>
        <div className="text-xs font-bold text-lavender">
          适合快速联机或通过分享的房间号直接加入。
        </div>
      </div>
      <button
        onClick={onJoin}
        className="mt-6 w-full h-14 bg-ink text-white rounded-2xl font-black text-lg shadow-xl shadow-ink/20 hover:-translate-y-0.5 transition-transform flex items-center justify-center gap-2"
      >
        进入房间 <ArrowRight size={20} />
      </button>
    </div>
  );
}
