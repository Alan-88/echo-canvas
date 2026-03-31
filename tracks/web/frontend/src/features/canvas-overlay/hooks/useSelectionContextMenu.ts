import { useEffect, useState } from 'react';

interface ContextMenuState {
  x: number;
  y: number;
  kind: 'empty' | 'selection';
}

interface OpenMenuOptions {
  clientX: number;
  clientY: number;
  containerRect: DOMRect;
  kind?: 'empty' | 'selection';
}

export const useSelectionContextMenu = () => {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const openMenu = ({ clientX, clientY, containerRect, kind = 'selection' }: OpenMenuOptions) => {
    setMenu({
      x: clientX - containerRect.left,
      y: clientY - containerRect.top,
      kind,
    });
  };

  const closeMenu = () => setMenu(null);

  useEffect(() => {
    if (!menu) return;

    const close = () => setMenu(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);

    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [menu]);

  return {
    menu,
    openMenu,
    closeMenu,
  };
};
