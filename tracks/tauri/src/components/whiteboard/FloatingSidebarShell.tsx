import React from 'react';

interface FloatingSidebarShellProps {
  side: 'left' | 'right';
  isOpen: boolean;
  zIndexClassName?: string;
  widthClassName?: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

export const FloatingSidebarShell: React.FC<FloatingSidebarShellProps> = ({
  side,
  isOpen,
  zIndexClassName = 'z-30',
  widthClassName = 'w-[min(18rem,calc(100vw-1.5rem))] md:w-72',
  children,
  onClick,
}) => {
  const sideClassName =
    side === 'left'
      ? isOpen
        ? 'left-3 md:left-6 translate-x-0'
        : 'left-3 md:left-6 -translate-x-[120%]'
      : isOpen
        ? 'right-3 md:right-6 translate-x-0'
        : 'right-3 md:right-6 translate-x-[120%]';

  return (
    <aside
      className={`absolute ${sideClassName} top-20 bottom-3 md:top-24 md:bottom-6 ${widthClassName} max-h-[calc(100dvh-5.75rem)] md:max-h-[calc(100dvh-7.5rem)] bg-white/95 backdrop-blur-xl rounded-4xl shadow-2xl border border-white/50 flex flex-col overflow-hidden transition-transform duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${zIndexClassName}`}
      onClick={onClick}
    >
      {children}
    </aside>
  );
};
