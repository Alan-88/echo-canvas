import { RefreshCw } from 'lucide-react';

type CheckStatus = 'idle' | 'checking' | 'exists' | 'new';

const statusText = (status: CheckStatus) => {
  if (status === 'checking') return '正在检查远端房间状态...';
  if (status === 'exists') return '此房间已存在，将直接加入或覆盖导入';
  if (status === 'new') return '这是一个新房间';
  return '输入或生成 8 位房间号';
};

type RemoteLobbyRoomCardProps = {
  roomId: string;
  checkStatus: CheckStatus;
  onRoomIdChange: (value: string) => void;
  onGenerateRoomId: () => void;
};

export function RemoteLobbyRoomCard({
  roomId,
  checkStatus,
  onRoomIdChange,
  onGenerateRoomId,
}: RemoteLobbyRoomCardProps) {
  const statusClassName =
    checkStatus === 'exists' ? 'text-green-600' : 'text-lavender';

  return (
    <>
      <div className="bg-input rounded-[32px] p-3 flex items-center justify-between pl-6 pr-3">
        <input
          value={roomId}
          onChange={(event) => onRoomIdChange(event.target.value)}
          placeholder="输入或生成房间号"
          maxLength={8}
          className="bg-transparent font-black text-2xl tracking-[0.25em] text-ink outline-none w-full"
        />
        <button
          onClick={onGenerateRoomId}
          className="w-12 h-12 rounded-2xl bg-white shadow-sm hover:scale-105 transition-transform flex items-center justify-center text-ink"
          title="随机生成房间号"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="mt-3 text-sm font-bold min-h-6">
        <span className={statusClassName}>{statusText(checkStatus)}</span>
      </div>
    </>
  );
}
