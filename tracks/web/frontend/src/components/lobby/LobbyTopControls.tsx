import React, { useEffect, useRef, useState } from 'react';
import { Github, Server } from 'lucide-react';
import { getCustomServerAddress, setCustomServerAddress } from '../../utils/remoteSessionConfig';
import { PROJECT_GITHUB_URL, PROJECT_NAME } from '../../constants/projectMeta';

export const LobbyTopControls: React.FC = () => {
  const [showServerSwitcher, setShowServerSwitcher] = useState(false);
  const [tempServerInput, setTempServerInput] = useState('');
  const switcherRef = useRef<HTMLDivElement>(null);

  const currentServerDisplay = getCustomServerAddress() || 'Official Server';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setShowServerSwitcher(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApplyServer = () => {
    const value = tempServerInput.trim();
    setCustomServerAddress(value || null);
    window.location.reload();
  };

  return (
    <>
      <div className="absolute top-6 left-6 z-20" ref={switcherRef}>
        <button
          onClick={() => {
            setTempServerInput(getCustomServerAddress() || '');
            setShowServerSwitcher(!showServerSwitcher);
          }}
          className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm border border-white/60 hover:bg-white transition-colors"
        >
          <Server size={18} className="text-lavender" />
          <div className="flex flex-col items-start leading-none gap-1 text-left">
            <span className="text-[10px] text-lavender uppercase tracking-wider font-black">Node</span>
            <span className="text-sm font-bold text-ink truncate max-w-[200px]">{currentServerDisplay}</span>
          </div>
          <span className="flex h-2 w-2 relative ml-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        </button>

        {showServerSwitcher && (
          <div
            className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-white/50 p-4 origin-top-left"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
          >
            <div className="text-[10px] uppercase font-black text-lavender mb-2">Switch Server Endpoint</div>
            <p className="text-xs font-bold text-ink/70 mb-4">
              You can connect to any compatible local or remote backend.
            </p>
            <input
              value={tempServerInput}
              onChange={(event) => setTempServerInput(event.target.value)}
              placeholder="Leave empty for Official Server"
              className="w-full bg-input rounded-xl px-3 py-2 text-sm font-bold text-ink outline-none border border-transparent focus:border-lavender transition-colors mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowServerSwitcher(false)}
                className="flex-1 py-2 text-xs font-bold text-lavender hover:bg-input rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyServer}
                className="flex-1 py-2 text-xs font-bold bg-ink text-white rounded-xl shadow-md hover:opacity-90 transition-opacity"
              >
                Apply & Reload
              </button>
            </div>
          </div>
        )}
      </div>

      <a
        href={PROJECT_GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        title={`Open ${PROJECT_NAME} on GitHub`}
        aria-label={`Open ${PROJECT_NAME} on GitHub`}
        className="absolute top-6 right-6 z-20 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-ink shadow-sm backdrop-blur-md transition-colors hover:bg-white"
      >
        <Github size={20} />
        <span className="sr-only">{PROJECT_NAME} GitHub repository</span>
      </a>
    </>
  );
};
