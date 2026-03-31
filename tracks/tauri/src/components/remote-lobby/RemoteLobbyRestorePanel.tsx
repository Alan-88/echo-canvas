import { AlertTriangle } from 'lucide-react';

type RestoreState = {
  token: string;
  error: string;
  isRestoring: boolean;
};

type RemoteLobbyRestorePanelProps = {
  state: RestoreState;
  onTokenChange: (token: string) => void;
  onRestore: () => void;
};

export function RemoteLobbyRestorePanel({
  state,
  onTokenChange,
  onRestore,
}: RemoteLobbyRestorePanelProps) {
  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-[28px] bg-input p-5">
        <div className="text-[10px] uppercase tracking-wider font-black text-lavender">
          Restore Token
        </div>
        <textarea
          value={state.token}
          onChange={(event) => onTokenChange(event.target.value)}
          placeholder="粘贴服务器 restore token"
          className="mt-3 h-40 w-full resize-none rounded-2xl border border-[#E0D8F0] bg-white p-4 font-mono text-sm text-ink outline-none"
        />
      </div>

      {state.error ? (
        <div className="rounded-3xl bg-red-50 border border-red-200 p-5 text-red-600 font-bold flex items-center gap-2">
          <AlertTriangle size={18} />
          {state.error}
        </div>
      ) : null}

      <button
        onClick={onRestore}
        disabled={state.isRestoring || !state.token.trim()}
        className="w-full h-14 bg-[#FA6400] text-white rounded-2xl font-black text-lg shadow-xl shadow-[#FA6400]/20 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state.isRestoring ? '恢复中...' : '开始恢复'}
      </button>
    </div>
  );
}
