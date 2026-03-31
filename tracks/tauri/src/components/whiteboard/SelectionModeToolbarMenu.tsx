import React, { useEffect, useRef, useState } from 'react';
import { LassoSelect, SquareDashedMousePointer } from 'lucide-react';
import {
  useSelectionModePreference,
  type SelectionMode,
} from '../../features/canvas-overlay/hooks/useSelectionModePreference';

interface SelectionModeToolbarMenuProps {
  isSelectToolActive: boolean;
  onSelectToolActivate: () => void;
  buttonClassName: string;
}

const modeButtonClass = (active: boolean) =>
  `w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
    active
      ? 'border-[#4B7BF5] bg-[#4B7BF5] text-white'
      : 'border-transparent text-[#5E587B] hover:border-white/70 hover:bg-white/70'
  }`;

const getModeIcon = (selectionMode: SelectionMode) =>
  selectionMode === 'lasso' ? LassoSelect : SquareDashedMousePointer;

export const SelectionModeToolbarMenu: React.FC<SelectionModeToolbarMenuProps> = ({
  isSelectToolActive,
  onSelectToolActivate,
  buttonClassName,
}) => {
  const [open, setOpen] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { selectionMode, setSelectionMode, resolveSelectionDragMode } = useSelectionModePreference();
  const displayMode =
    isSelectToolActive && isShiftPressed
      ? resolveSelectionDragMode(true)
      : selectionMode;
  const CurrentModeIcon = getModeIcon(displayMode);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isSelectToolActive) {
      setOpen(false);
    }
  }, [isSelectToolActive]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };
    const handleBlur = () => {
      setIsShiftPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isSelectToolActive) {
      setOpen((value) => !value);
      return;
    }
    onSelectToolActivate();
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={handleButtonClick}
        className={buttonClassName}
        title="选择 (V)"
      >
        <CurrentModeIcon className="w-5 h-5" />
      </button>

      <div
        className={`absolute top-full left-1/2 mt-2 -translate-x-1/2 rounded-2xl border border-white/60 bg-white p-2 shadow-xl transition-all origin-top ${
          open ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible pointer-events-none'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectionMode('marquee');
              setOpen(false);
            }}
            className={modeButtonClass(selectionMode === 'marquee')}
            title="矩形框选"
          >
            <SquareDashedMousePointer className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectionMode('lasso');
              setOpen(false);
            }}
            className={modeButtonClass(selectionMode === 'lasso')}
            title="套索框选"
          >
            <LassoSelect className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
