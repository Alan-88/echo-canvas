import React from 'react';
import { Plus, Minus } from 'lucide-react';

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  scale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}) => {
  const formatZoom = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  return (
    <div className="absolute bottom-8 right-8 bg-white/90 backdrop-blur rounded-full shadow-xl border border-white/50 p-1.5 flex items-center gap-2 z-10">
      <button
        onClick={onZoomOut}
        className="w-8 h-8 rounded-full hover:bg-[#F5F0FF] text-[#342E55] flex items-center justify-center transition-colors"
        title="Zoom Out"
      >
        <Minus className="w-4 h-4" />
      </button>
      
      <button
        onClick={onResetZoom}
        className="text-xs font-black font-mono w-12 text-center text-[#342E55] hover:text-purple-600 transition-colors"
        title="Reset Zoom"
      >
        {formatZoom(scale)}
      </button>
      
      <button
        onClick={onZoomIn}
        className="w-8 h-8 rounded-full hover:bg-[#F5F0FF] text-[#342E55] flex items-center justify-center transition-colors"
        title="Zoom In"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
