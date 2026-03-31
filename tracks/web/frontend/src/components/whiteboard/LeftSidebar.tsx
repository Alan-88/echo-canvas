import React, { useState } from 'react';
import { Copy, Info, LogOut, Power, Loader2, CloudUpload, Check, Download, Image, FileJson } from 'lucide-react';
import { LeftSidebarInputModeCard } from './LeftSidebarInputModeCard';
import { FloatingSidebarShell } from './FloatingSidebarShell';

interface LeftSidebarProps {
  isOpen: boolean;
  roomId: string;
  tokenState: 'unsaved' | 'syncing' | 'synced';
  savedToken: string | null;
  stylusModeEnabled: boolean;
  onCopyRoomId: () => void;
  onCopyToken: () => void;
  onStylusModeChange: (enabled: boolean) => void;
  onSaveRoom: () => void;
  onExportPNG: () => void;
  onExportWhiteboard: () => void;
  onLeaveRoom: () => void;
  onCloseRoom: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  isOpen,
  roomId,
  tokenState,
  savedToken,
  stylusModeEnabled,
  onCopyRoomId,
  onCopyToken,
  onStylusModeChange,
  onSaveRoom,
  onExportPNG,
  onExportWhiteboard,
  onLeaveRoom,
  onCloseRoom,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportButtonRef, setExportButtonRef] = useState<HTMLDivElement | null>(null);

  const formatRoomId = (id: string) => {
    const parts = id.match(/.{1,4}/g);
    return parts ? parts.join('-') : id;
  };

  const formatToken = (token: string) => {
    if (token.length <= 12) return token;
    return `${token.slice(0, 8)}...${token.slice(-4)}`;
  };

  return (
    <>
      <FloatingSidebarShell side="left" isOpen={isOpen} zIndexClassName="z-40" onClick={(e) => e.stopPropagation()}>
      {/* Main Content */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide p-4 md:p-6 space-y-6 md:space-y-8">
        {/* Session Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-lavender">
            <Info className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-widest">SESSION INFO</span>
          </div>

          {/* Room ID */}
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

          {/* Token */}
          <div className="bg-input rounded-2xl p-4 border border-transparent transition-all duration-300">
            <div className="flex justify-between items-start mb-1">
              <div className="text-[10px] text-lavender font-bold uppercase">Token</div>
              <div
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  tokenState === 'synced'
                    ? 'bg-green-50 text-green-600'
                    : tokenState === 'syncing'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-cream text-[#FA6400]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    tokenState === 'synced'
                      ? 'bg-green-500'
                      : tokenState === 'syncing'
                      ? 'bg-blue-500'
                      : 'bg-[#FA6400]'
                  }`}
                />
                {tokenState === 'synced' ? 'Synced' : tokenState === 'syncing' ? 'Syncing' : 'Unsaved'}
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

        <div className="w-full h-px bg-[#E0D8F0]" />

        <LeftSidebarInputModeCard
          stylusModeEnabled={stylusModeEnabled}
          onStylusModeChange={onStylusModeChange}
        />

        <div className="w-full h-px bg-[#E0D8F0]" />

        {/* Actions */}
        <div className="space-y-3">
          {/* Save/Sync Button */}
          <button
            onClick={onSaveRoom}
            disabled={tokenState === 'syncing'}
            className={`w-full h-12 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 group ${
              tokenState === 'synced'
                ? 'bg-white border border-green-200 text-green-600'
                : 'bg-white border border-[#E0D8F0] hover:border-ink hover:shadow-md text-ink'
            }`}
          >
            {tokenState === 'syncing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-lavender" />
                <span>Syncing...</span>
              </>
            ) : tokenState === 'synced' ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span>Synced</span>
              </>
            ) : (
              <>
                <CloudUpload className="w-4 h-4 text-ink group-hover:scale-110 transition-transform" />
                <span>Sync to Server</span>
              </>
            )}
          </button>

          {/* Export Button */}
          <div
            ref={setExportButtonRef}
            onMouseEnter={() => setShowExportMenu(true)}
            onMouseLeave={() => setShowExportMenu(false)}
          >
            <button className="w-full h-12 bg-white border border-[#E0D8F0] hover:border-green-500 hover:text-green-600 hover:shadow-md text-ink rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              Export Data
            </button>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 bg-input/50 backdrop-blur-sm border-t border-[#E0D8F0] space-y-2">
        <button
          onClick={onLeaveRoom}
          className="w-full py-2.5 text-lavender hover:text-ink hover:bg-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Leave Room
        </button>

        <button
          onClick={onCloseRoom}
          className="w-full py-2.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
        >
          <Power className="w-4 h-4" />
          Close Room
        </button>
      </div>
      </FloatingSidebarShell>

      {/* Export Submenu - Positioned outside overflow container */}
      {exportButtonRef && (
        <div
          onMouseEnter={() => setShowExportMenu(true)}
          onMouseLeave={() => setShowExportMenu(false)}
          className={`fixed z-50 transition-all duration-300 pl-4 ${
            showExportMenu && isOpen
              ? 'opacity-100 translate-x-0 visible'
              : 'opacity-0 -translate-x-2 invisible pointer-events-none'
          }`}
          style={{
            left: `${exportButtonRef.getBoundingClientRect().right}px`,
            top: `${exportButtonRef.getBoundingClientRect().top}px`,
          }}
        >
          <div className="w-48 bg-white rounded-2xl shadow-xl border border-white/50 p-2">
            <div className="text-[10px] uppercase font-black text-lavender px-3 py-2">
              Select Format
            </div>
            <button
              onClick={onExportPNG}
              className="w-full flex items-center px-3 py-2.5 text-sm font-bold text-ink hover:bg-input rounded-xl transition-colors text-left gap-3"
            >
              <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                <Image className="w-3.5 h-3.5" />
              </div>
              PNG Image
            </button>
            <button
              onClick={onExportWhiteboard}
              className="w-full flex items-center px-3 py-2.5 text-sm font-bold text-ink hover:bg-input rounded-xl transition-colors text-left gap-3"
            >
              <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <FileJson className="w-3.5 h-3.5" />
              </div>
              Export .whiteboard
            </button>
          </div>
        </div>
      )}
    </>
  );
};
