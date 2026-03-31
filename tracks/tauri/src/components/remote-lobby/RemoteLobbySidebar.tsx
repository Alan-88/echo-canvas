import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, FileUp, Key, Plus, Server } from 'lucide-react';

export type RemoteMode = 'create' | 'import' | 'restore';

type ModeButton = {
  mode: RemoteMode;
  label: string;
  icon: LucideIcon;
  activeClassName: string;
  inactiveClassName: string;
};

const MODE_BUTTONS: ModeButton[] = [
  {
    mode: 'create',
    label: '创建 / 加入房间',
    icon: Plus,
    activeClassName: 'bg-ink text-white shadow-lg shadow-ink/20',
    inactiveClassName: 'bg-white text-ink border border-[#E0D8F0] hover:border-ink',
  },
  {
    mode: 'import',
    label: '导入到远端房间',
    icon: FileUp,
    activeClassName: 'bg-[#1D5E84] text-white shadow-lg shadow-[#1D5E84]/20',
    inactiveClassName: 'bg-white text-ink border border-[#E0D8F0] hover:border-[#1D5E84]',
  },
  {
    mode: 'restore',
    label: 'Token 恢复',
    icon: Key,
    activeClassName: 'bg-[#FA6400] text-white shadow-lg shadow-[#FA6400]/20',
    inactiveClassName: 'bg-white text-ink border border-[#E0D8F0] hover:border-[#FA6400]',
  },
];

type RemoteLobbySidebarProps = {
  activeMode: RemoteMode;
  onBack: () => void;
  onModeChange: (mode: RemoteMode) => void;
  serverAddress: string;
};

export function RemoteLobbySidebar({
  activeMode,
  onBack,
  onModeChange,
  serverAddress,
}: RemoteLobbySidebarProps) {
  return (
    <aside className="bg-[#F7F2FF] border-r border-[#E0D8F0] p-6 flex flex-col">
      <button
        onClick={onBack}
        className="w-fit flex items-center gap-2 text-sm font-bold text-lavender hover:text-ink transition-colors"
      >
        <ArrowLeft size={16} />
        返回总大厅
      </button>

      <div className="mt-8 rounded-3xl bg-white p-5 shadow-sm border border-[#E0D8F0]">
        <div className="text-[10px] uppercase tracking-wider font-black text-lavender">
          Remote Server
        </div>
        <div className="mt-3 flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF4E5] text-[#FA6400] flex items-center justify-center shrink-0">
            <Server size={18} />
          </div>
          <div className="min-w-0">
            <div className="font-black text-sm text-ink">当前服务器</div>
            <div className="text-xs font-bold text-lavender break-all mt-1">{serverAddress}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {MODE_BUTTONS.map((button) => {
          const Icon = button.icon;
          const isActive = activeMode === button.mode;
          return (
            <button
              key={button.mode}
              onClick={() => onModeChange(button.mode)}
              className={`w-full rounded-2xl px-4 py-3 text-left font-bold transition-all ${
                isActive ? button.activeClassName : button.inactiveClassName
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} />
                {button.label}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
