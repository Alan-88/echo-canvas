import React from 'react';
import { PenTool } from 'lucide-react';

interface LeftSidebarInputModeCardProps {
  stylusModeEnabled: boolean;
  onStylusModeChange: (enabled: boolean) => void;
}

export const LeftSidebarInputModeCard: React.FC<LeftSidebarInputModeCardProps> = ({
  stylusModeEnabled,
  onStylusModeChange,
}) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 text-lavender">
      <PenTool className="w-4 h-4" />
      <span className="text-xs font-black uppercase tracking-widest">输入模式</span>
    </div>

    <div className="bg-input rounded-2xl p-4 border border-transparent hover:border-[#E0D8F0] transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-black text-ink">开启手写笔</div>

        <button
          type="button"
          role="switch"
          aria-checked={stylusModeEnabled}
          onClick={() => onStylusModeChange(!stylusModeEnabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors focus:outline-none ${
            stylusModeEnabled ? 'bg-ink' : 'bg-white border border-[#D8D2E8]'
          }`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              stylusModeEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  </div>
);
