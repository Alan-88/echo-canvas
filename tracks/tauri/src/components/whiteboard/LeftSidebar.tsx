import React, { useState } from 'react';
import { Download, LogOut, Power, Image, FileJson, Loader2, CloudUpload, Check, Save, FolderOpen } from 'lucide-react';
import { LeftSidebarInputModeCard } from './LeftSidebarInputModeCard';
import { FloatingSidebarShell } from './FloatingSidebarShell';
import { LeftSidebarSessionCard } from './LeftSidebarSessionCard';
import { getPrimarySaveActionLabel, getRoomSessionMode } from '../../utils/roomSessionMode';

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
  onExportJSON: () => void;
  onOpenWhiteboardFile: () => void;
  onSaveWhiteboardAs: () => void;
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
  onExportJSON,
  onOpenWhiteboardFile,
  onSaveWhiteboardAs,
  onLeaveRoom,
  onCloseRoom,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportButtonRef, setExportButtonRef] = useState<HTMLDivElement | null>(null);
  const sessionMode = getRoomSessionMode(roomId);
  const isLocalSession = sessionMode === 'local';
  const primarySaveLabel = getPrimarySaveActionLabel(sessionMode, tokenState);

  return (
    <>
      <FloatingSidebarShell side="left" isOpen={isOpen} zIndexClassName="z-40" onClick={(e) => e.stopPropagation()}>
      {/* Main Content */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide p-4 md:p-6 space-y-6 md:space-y-8">
        <LeftSidebarSessionCard
          roomId={roomId}
          tokenState={tokenState}
          savedToken={savedToken}
          onCopyRoomId={onCopyRoomId}
          onCopyToken={onCopyToken}
        />

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
                <span>{primarySaveLabel}</span>
              </>
            ) : tokenState === 'synced' ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span>{primarySaveLabel}</span>
              </>
            ) : (
              <>
                {isLocalSession ? (
                  <Save className="w-4 h-4 text-ink group-hover:scale-110 transition-transform" />
                ) : (
                  <CloudUpload className="w-4 h-4 text-ink group-hover:scale-110 transition-transform" />
                )}
                <span>{primarySaveLabel}</span>
              </>
            )}
          </button>

          {isLocalSession && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onOpenWhiteboardFile}
                className="h-11 rounded-2xl bg-white border border-[#E0D8F0] hover:border-ink hover:shadow-md text-ink text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                Open
              </button>
              <button
                onClick={onSaveWhiteboardAs}
                className="h-11 rounded-2xl bg-white border border-[#E0D8F0] hover:border-ink hover:shadow-md text-ink text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save As
              </button>
            </div>
          )}

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
          {isLocalSession ? 'Back to Lobby' : 'Leave Room'}
        </button>

        {!isLocalSession && (
          <button
            onClick={onCloseRoom}
            className="w-full py-2.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
          >
            <Power className="w-4 h-4" />
            Close Room
          </button>
        )}
      </div>
      </FloatingSidebarShell>

      {/* Export Submenu - Positioned outside overflow container */}
      {exportButtonRef && (
        <div
          onMouseEnter={() => setShowExportMenu(true)}
          onMouseLeave={() => setShowExportMenu(false)}
          className={`fixed w-48 bg-white rounded-2xl shadow-xl border border-white/50 p-2 z-50 transition-all duration-300 ${
            showExportMenu && isOpen
              ? 'opacity-100 translate-x-0 visible'
              : 'opacity-0 -translate-x-2 invisible pointer-events-none'
          }`}
          style={{
            left: `${exportButtonRef.getBoundingClientRect().right + 8}px`,
            top: `${exportButtonRef.getBoundingClientRect().top}px`,
          }}
        >
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
            onClick={onExportJSON}
            className="w-full flex items-center px-3 py-2.5 text-sm font-bold text-ink hover:bg-input rounded-xl transition-colors text-left gap-3"
          >
            <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <FileJson className="w-3.5 h-3.5" />
            </div>
            Export .whiteboard
          </button>
        </div>
      )}
    </>
  );
};
