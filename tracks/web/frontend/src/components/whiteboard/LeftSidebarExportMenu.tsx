import React from 'react';
import { Download, FileArchive, Image } from 'lucide-react';

interface LeftSidebarExportMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onExportPNG: () => void;
  onExportWhiteboard: () => void;
}

export const LeftSidebarExportMenu: React.FC<LeftSidebarExportMenuProps> = ({
  isOpen,
  onToggle,
  onExportPNG,
  onExportWhiteboard,
}) => (
  <div className="space-y-2">
    <button
      type="button"
      onClick={onToggle}
      className={`w-full h-12 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
        isOpen
          ? 'bg-white border border-green-500 text-green-600 shadow-md'
          : 'bg-white border border-[#E0D8F0] hover:border-green-500 hover:text-green-600 hover:shadow-md text-ink'
      }`}
    >
      <Download className="w-4 h-4" />
      Export Data
    </button>

    {isOpen && (
      <div className="bg-white rounded-2xl shadow-md border border-white/50 p-2">
        <div className="text-[10px] uppercase font-black text-lavender px-3 py-2">
          Select Format
        </div>
        <button
          type="button"
          onClick={onExportPNG}
          className="w-full flex items-center px-3 py-2.5 text-sm font-bold text-ink hover:bg-input rounded-xl transition-colors text-left gap-3"
        >
          <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
            <Image className="w-3.5 h-3.5" />
          </div>
          PNG Image
        </button>
        <button
          type="button"
          onClick={onExportWhiteboard}
          className="w-full flex items-center px-3 py-2.5 text-sm font-bold text-ink hover:bg-input rounded-xl transition-colors text-left gap-3"
        >
          <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
            <FileArchive className="w-3.5 h-3.5" />
          </div>
          Whiteboard File
        </button>
      </div>
    )}
  </div>
);
