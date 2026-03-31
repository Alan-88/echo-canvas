import React, { useState } from 'react';
import { 
  MonitorPlay, Globe, FileUp, ChevronUp, ChevronDown, 
  X, Plus, FileClock, ShieldCheck, ArrowRight, Server, Zap 
} from 'lucide-react';
import { useLobbyLogic } from '../hooks/useLobbyLogic';

export const Lobby: React.FC = () => {
  const logic = useLobbyLogic();
  
  const [activeIndex, setActiveIndex] = useState(0); 
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMode, setActiveMode] = useState<'single' | 'multi' | 'migrate'>('single');
  
  const scroll = (direction: number) => {
    let next = activeIndex + direction;
    if (next > 2) next = 0;
    if (next < 0) next = 2;
    setActiveIndex(next);
  };

  const goExpand = (mode: 'single' | 'multi' | 'migrate') => {
    setActiveMode(mode);
    setIsExpanded(true);
  };

  const springTransition = "transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]";
  const slideTransition = "transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]";

  const selectedSave = logic.single.saves.find(s => s.id === logic.single.selectedSaveId);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-cream relative overflow-hidden font-sans text-ink">
      
      {/* Main Card Container */}
      <div 
        className={`bg-white shadow-2xl shadow-ink/10 relative overflow-hidden ${springTransition} z-10`}
        style={{
          width: isExpanded ? '800px' : '520px',
          height: isExpanded ? '520px' : '240px',
          borderRadius: isExpanded ? '48px' : '40px',
          padding: isExpanded ? '2rem' : '0'
        }}
      >
        {/* Close Button */}
        {isExpanded && (
          <button 
            onClick={() => setIsExpanded(false)}
            className="absolute top-6 right-6 z-20 w-10 h-10 rounded-full bg-input flex items-center justify-center text-ink hover:bg-lavender/20 transition-colors active:scale-95"
          >
            <X size={20} />
          </button>
        )}

        {/* === State 1: COMPACT MODE === */}
        {!isExpanded && (
          <div className="w-full h-full flex flex-col relative">
            <div className="absolute top-[-50%] right-[-10%] w-64 h-64 rounded-full bg-cream opacity-80 pointer-events-none"></div>

            <button onClick={() => scroll(-1)} className="h-8 w-full z-10 flex justify-center items-end pb-1 opacity-0 hover:opacity-100 transition-opacity">
              <ChevronUp size={16} className="text-lavender" />
            </button>

            <div className="flex-1 relative overflow-hidden">
              <div className={`absolute inset-0 flex flex-col ${slideTransition}`} style={{ transform: `translateY(-${activeIndex * 100}%)` }}>
                
                {/* Item 1: Single Player */}
                <div className="h-full w-full shrink-0 flex items-center px-8 gap-6">
                  <div className="w-20 h-20 rounded-3xl bg-cream flex items-center justify-center text-ink shrink-0">
                    <MonitorPlay size={32} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-black tracking-tight">单人游戏</h2>
                    <p className="text-sm font-bold text-lavender mt-1">本地画板，安全私密</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <button onClick={() => goExpand('single')} className="bg-ink text-white w-32 h-10 rounded-2xl font-bold text-sm hover:bg-ink/90 transition-colors shadow-lg shadow-ink/20 active:scale-95">
                      选择存档
                    </button>
                  </div>
                </div>

                {/* Item 2: Multiplayer */}
                <div className="h-full w-full shrink-0 flex items-center px-8 gap-6">
                  <div className="w-20 h-20 rounded-3xl bg-[#FFF4E5] flex items-center justify-center text-[#FA6400] shrink-0">
                    <Globe size={32} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-black tracking-tight">多人联机</h2>
                    <p className="text-sm font-bold text-lavender mt-1">连接服务器，加入好友</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <button onClick={() => goExpand('multi')} className="bg-[#FA6400] text-white w-32 h-10 rounded-2xl font-bold text-sm hover:bg-[#FA6400]/90 transition-colors shadow-lg shadow-[#FA6400]/20 active:scale-95">
                      输入地址
                    </button>
                  </div>
                </div>

                {/* Item 3: Migrate/Import */}
                <div className="h-full w-full shrink-0 flex items-center px-8 gap-6">
                  <div className="w-20 h-20 rounded-3xl bg-[#E5F6FE] flex items-center justify-center text-[#1D5E84] shrink-0">
                    <FileUp size={32} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-black tracking-tight">数据迁移</h2>
                    <p className="text-sm font-bold text-lavender mt-1">导入旧版文件或密钥</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <button onClick={() => goExpand('migrate')} className="bg-[#1D5E84] text-white w-32 h-10 rounded-2xl font-bold text-sm hover:bg-[#1D5E84]/90 transition-colors shadow-lg shadow-[#1D5E84]/20 active:scale-95">
                      开始导入
                    </button>
                  </div>
                </div>

              </div>
            </div>

            <button onClick={() => scroll(1)} className="h-8 w-full z-10 flex justify-center items-start pt-1 opacity-0 hover:opacity-100 transition-opacity">
              <ChevronDown size={16} className="text-lavender" />
            </button>

            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${i === activeIndex ? 'bg-ink scale-125' : 'bg-lavender/30'}`} />
              ))}
            </div>
          </div>
        )}

        {/* === State 2: EXPANDED MODE === */}
        {isExpanded && (
          <div className="w-full h-full flex gap-8 animate-fade-in opacity-0" style={{ animationFillMode: 'forwards', animationName: 'fadeIn', animationDuration: '0.3s' }}>
            
            <div className="flex-1 flex flex-col justify-start pl-4 py-2">
              
              {/* --- Single Player --- */}
              {activeMode === 'single' && (
                <>
                  <span className="inline-block px-3 py-1 rounded-full bg-cream text-ink text-xs font-black tracking-wider w-fit mb-4">LOCAL SAVES</span>
                  <h1 className="text-3xl font-black text-ink mb-4">选择世界</h1>
                  
                  <button onClick={logic.single.createSave} className="w-full h-12 border-2 border-dashed border-lavender/50 bg-white rounded-2xl flex items-center justify-center gap-2 text-ink font-bold hover:border-ink hover:bg-input transition-colors mb-4 shrink-0">
                    <Plus size={18} />
                    <span>创建新画布</span>
                  </button>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    {logic.single.saves.map(save => (
                      <div 
                        key={save.id}
                        onClick={() => logic.single.setSelectedSaveId(save.id)}
                        className={`p-4 rounded-2xl cursor-pointer border-2 transition-all ${logic.single.selectedSaveId === save.id ? 'border-ink bg-input' : 'border-transparent hover:bg-input'}`}
                      >
                        <div className="font-bold text-ink truncate">{save.name}</div>
                        <div className="flex items-center gap-2 text-xs text-lavender font-bold mt-1">
                          <FileClock size={12} /> {save.date}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={logic.single.enterSave} className="w-full h-14 bg-ink text-white rounded-2xl font-black text-lg shadow-xl shadow-ink/20 hover:-translate-y-0.5 transition-transform flex items-center justify-center gap-2 shrink-0 mt-4">
                    进入所选世界 <ArrowRight size={20} />
                  </button>
                </>
              )}

              {/* --- Multi Player --- */}
              {activeMode === 'multi' && (
                <>
                  <span className="inline-block px-3 py-1 rounded-full bg-[#FFF4E5] text-[#FA6400] text-xs font-black tracking-wider w-fit mb-4">CONNECT SERVER</span>
                  <h1 className="text-3xl font-black text-ink mb-2">连接服务器</h1>
                  <p className="text-lavender font-bold text-sm mb-6">输入局域网地址或官方大厅地址</p>
                  
                  <div className="space-y-4 mb-auto">
                    <div>
                      <label className="text-[10px] text-lavender uppercase tracking-wider font-bold mb-1 block pl-2">服务器地址</label>
                      <div className="bg-input rounded-2xl p-3 flex items-center px-4 focus-within:ring-2 focus-within:ring-[#FA6400]/50 transition-all">
                        <Server size={18} className="text-lavender mr-3" />
                        <input 
                          value={logic.multi.serverAddress}
                          onChange={e => logic.multi.setServerAddress(e.target.value)}
                          placeholder="例如: 192.168.1.100:3000"
                          className="bg-transparent font-bold text-ink outline-none w-full placeholder:text-lavender/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-lavender uppercase tracking-wider font-bold mb-1 block pl-2">房间号 (选填)</label>
                      <div className="bg-input rounded-2xl p-3 flex items-center px-4 focus-within:ring-2 focus-within:ring-[#FA6400]/50 transition-all">
                        <input 
                          value={logic.multi.roomId}
                          onChange={e => logic.multi.setRoomId(e.target.value)}
                          placeholder="留空则进入大厅/随机匹配"
                          className="bg-transparent font-bold text-ink outline-none w-full placeholder:text-lavender/50"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 p-3 rounded-xl mt-4">
                      <Zap size={16} />
                      <span>{logic.multi.statusText}</span>
                    </div>
                  </div>

                  <button onClick={logic.multi.connect} disabled={logic.multi.isConnecting} className="w-full h-14 bg-[#FA6400] text-white rounded-2xl font-black text-lg shadow-xl shadow-[#FA6400]/20 hover:-translate-y-0.5 transition-transform flex items-center justify-center gap-2 shrink-0 mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
                    建立连接 <ArrowRight size={20} />
                  </button>
                </>
              )}

              {/* --- Migrate --- */}
              {activeMode === 'migrate' && (
                <>
                  <span className="inline-block px-3 py-1 rounded-full bg-[#E5F6FE] text-[#1D5E84] text-xs font-black tracking-wider w-fit mb-4">IMPORT & CONVERT</span>
                  <h1 className="text-3xl font-black text-ink mb-2">数据迁移</h1>
                  <p className="text-lavender font-bold text-sm mb-6">导入旧版文件或恢复 Token</p>
                  
                  <div className="flex-1 flex flex-col gap-4">
                    <label className="border-2 border-dashed border-[#1D5E84]/30 rounded-3xl flex-1 flex flex-col items-center justify-center gap-3 hover:bg-[#E5F6FE]/30 hover:border-[#1D5E84] transition-colors cursor-pointer text-[#1D5E84]">
                      <FileUp size={32} />
                      <span className="font-bold text-sm">
                        {logic.migrate.state.file ? logic.migrate.state.file.name : '点击选择 .whiteboard 文件'}
                      </span>
                      <input 
                        type="file" 
                        accept=".whiteboard"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && logic.migrate.selectFile(e.target.files[0])} 
                      />
                    </label>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-lavender/20"></div></div>
                      <div className="relative flex justify-center"><span className="bg-white px-2 text-xs font-bold text-lavender">或者</span></div>
                    </div>

                    <div>
                      <div className="bg-input rounded-2xl p-3 flex items-center px-4">
                        <ShieldCheck size={18} className="text-lavender mr-3" />
                        <input 
                          value={logic.migrate.state.token}
                          onChange={(e) => logic.migrate.setToken(e.target.value)}
                          placeholder="粘贴恢复 Token" 
                          className="bg-transparent font-bold text-sm text-ink outline-none w-full placeholder:text-lavender/50" 
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={logic.migrate.execute}
                    disabled={(!logic.migrate.state.file && !logic.migrate.state.token) || logic.migrate.state.isMigrating}
                    className="w-full h-14 bg-[#1D5E84] text-white rounded-2xl font-black text-lg shadow-xl shadow-[#1D5E84]/20 hover:-translate-y-0.5 transition-transform flex items-center justify-center gap-2 shrink-0 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    转换并存入本地存档
                  </button>
                </>
              )}

            </div>

            {/* Right: Visual Preview Area */}
            <div className="w-[320px] bg-cream rounded-[2.5rem] relative overflow-hidden flex items-center justify-center group select-none flex-col">
              <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#827BB9_1px,transparent_1px)] bg-[size:20px_20px]"></div>
              
              {activeMode === 'single' && selectedSave && (
                <>
                  <div className="z-10 w-full px-6 flex flex-col mt-4">
                    <div className={`w-full aspect-video ${selectedSave.thumbnailBg} rounded-2xl shadow-lg border-4 border-white transform transition-transform duration-500 group-hover:scale-105 mb-6`}></div>
                    
                    <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-sm w-full">
                      <div className="text-[10px] text-lavender uppercase tracking-wider font-bold mb-1">存档摘要</div>
                      <div className="flex justify-between items-center text-sm font-bold text-ink mb-2">
                        <span>图层数</span>
                        <span>{selectedSave.layers}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold text-ink">
                        <span>文件大小</span>
                        <span>{selectedSave.size}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeMode === 'multi' && (
                <div className="z-10 flex flex-col items-center">
                  <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-[#FA6400]/20 animate-ping" style={{animationDuration: '2s'}}></div>
                    <div className="absolute inset-4 rounded-full border-4 border-[#FA6400]/40 animate-ping" style={{animationDuration: '2s', animationDelay: '0.5s'}}></div>
                    <Globe size={48} className="text-[#FA6400] z-10" />
                  </div>
                  <div className="bg-white/80 backdrop-blur-md rounded-2xl p-3 px-6 shadow-sm font-bold text-sm text-ink">
                    寻找局域网对局...
                  </div>
                </div>
              )}

              {activeMode === 'migrate' && (
                <div className="z-10 flex flex-col items-center">
                  <div className="w-24 h-24 rounded-3xl bg-[#E5F6FE] shadow-lg flex items-center justify-center mb-6 rotate-12 group-hover:rotate-0 transition-transform duration-500 text-[#1D5E84]">
                    <FileUp size={40} />
                  </div>
                  <div className="text-sm font-bold text-[#1D5E84] bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl">
                    自动转换为本地 .whiteboard
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
