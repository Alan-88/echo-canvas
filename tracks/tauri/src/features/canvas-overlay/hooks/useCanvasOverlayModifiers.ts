import { useEffect, useState } from 'react';

interface UseCanvasOverlayModifiersOptions {
  editingMarkdownOpen: boolean;
}

export const useCanvasOverlayModifiers = ({
  editingMarkdownOpen,
}: UseCanvasOverlayModifiersOptions) => {
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isRightMousePressed, setIsRightMousePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (editingMarkdownOpen) return;

      if (event.code === 'Space' && !isSpacePressed) {
        event.preventDefault();
        setIsSpacePressed(true);
      }

      if (event.key === 'Alt' && !isAltPressed) {
        event.preventDefault();
        setIsAltPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        setIsSpacePressed(false);
        setIsPanning(false);
      }

      if (event.key === 'Alt') {
        event.preventDefault();
        setIsAltPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editingMarkdownOpen, isAltPressed, isSpacePressed]);

  return {
    isSpacePressed,
    isAltPressed,
    isRightMousePressed,
    isPanning,
    setIsRightMousePressed,
    setIsPanning,
  };
};
