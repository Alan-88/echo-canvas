import React, { useState } from 'react';
import { 
  Plus, FileUp, Key, ChevronUp, ChevronDown, 
  X, RefreshCw, ArrowRight, CheckCircle, AlertTriangle, ShieldCheck, Eye
} from 'lucide-react';
import { useLobbyLogic } from '../hooks/useLobbyLogic';
import { getApiBaseUrl } from '../utils/runtimeNetwork';
import { LobbyTopControls } from '../components/lobby/LobbyTopControls';

export const Lobby: React.FC = () => {
  const logic = useLobbyLogic();
  
  const [activeIndex, setActiveIndex] = useState(0); 
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMode, setActiveMode] = useState<'create' | 'import' | 'restore'>('create');
  const currentApiBase = getApiBaseUrl() || window.location.origin;

  const scroll = (direction: number) => {
    let next = activeIndex + direction;
    if (next > 2) next = 0;
    if (next < 0) next = 2;
    setActiveIndex(next);
  };

  const goExpand = (mode: 'create' | 'import' | 'restore') => {
    setActiveMode(mode);
    setIsExpanded(true);
    if (!logic.create.roomId) {
      logic.create.setRoomId(logic.generateId());
    }
  };

  const springTransition = "transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]";
  const slideTransition = "transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]";

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-cream relative overflow-hidden font-sans text-ink">
      <LobbyTopControls />

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
            <div className="absolute top-[-50%] right-[-10%] w-64 h-64 rounded-full bg-cream opacity-50 pointer-events-none"></div>

            <button onClick={() => scroll(-1)} className="h-8 w-full z-10 flex justify-center items-end pb-1 opacity-0 hover:opacity-100 transition-opacity">
              <ChevronUp size={16} className="text-lavender" />
            </button>

            <div className="flex-1 relative overflow-hidden">
              <div className={`absolute inset-0 flex flex-col ${slideTransition}`} style={{ transform: `translateY(-${activeIndex * 100}%)` }}>
                
                {/* Item 1: Create Room */}
                <div className="h-full w-full shrink-0 flex items-center px-8 gap-6">
                  <div className="w-20 h-20 rounded-3xl bg-cream flex items-center justify-center text-ink shrink-0">
                    <Plus size={32} strokeWidth={3} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-black tracking-tight">远端房间</h2>
                    <p className="text-sm font-bold text-lavender mt-1">创建或加入联机协作</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <input 
                      type="text" 
                      placeholder="随机号码"
                      value={logic.create.roomId}
                      onChange={(e) => logic.create.setRoomId(e.target.value)}
                      maxLength={8}
                      className="bg-input w-32 h-10 rounded-2xl text-center font-bold text-sm outline-none text-ink placeholder:text-lavender/50 focus:ring-2 focus:ring-ink/20 transition-all"
                    />
                    <button onClick={() => goExpand('create')} className="bg-ink text-white w-32 h-10 rounded-2xl font-bold text-sm hover:bg-ink/90 transition-colors shadow-lg shadow-ink/20 active:scale-95">
                      进入
                    </button>
                  </div>
                </div>

                {/* Item 2: Import File */}
                <div className="h-full w-full shrink-0 flex items-center px-8 gap-6">
                  <div className="w-20 h-20 rounded-3xl bg-[#E5F6FE] flex items-center justify-center text-[#1D5E84] shrink-0">
                    <FileUp size={32} strokeWidth={3} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-black tracking-tight">导入白板</h2>
                    <p className="text-sm font-bold text-lavender mt-1">上传到远端服务器</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <label 
                      className={`w-32 h-10 rounded-2xl border-2 ${logic.import.state.file ? 'border-solid border-ink text-ink bg-white' : 'border-dashed border-lavender/50 text-lavender'} text-xs font-bold hover:border-ink hover:text-ink transition-colors flex items-center justify-center cursor-pointer overflow-hidden px-2`}
                      title={logic.import.state.file?.name}
                    >
                      <span className="truncate">
                        {logic.import.state.file ? logic.import.state.file.name : '选择文件...'}
                      </span>
                      <input 
                        type="file" 
                        accept=".whiteboard"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && logic.import.selectFile(e.target.files[0])} 
                      />
                    </label>
                    <button 
                      onClick={() => goExpand('import')} 
                      disabled={!logic.import.state.file}
                      className="bg-ink text-white w-32 h-10 rounded-2xl font-bold text-sm hover:bg-ink/90 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      验证并导入
                    </button>
                  </div>
                </div>

                {/* Item 3: Restore Token */}
                <div className="h-full w-full shrink-0 flex items-center px-8 gap-6">
                  <div className="w-20 h-20 rounded-3xl bg-[#FFF4E5] flex items-center justify-center text-[#FA6400] shrink-0">
                    <Key size={32} strokeWidth={3} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-black tracking-tight">Token 恢复</h2>
                    <p className="text-sm font-bold text-lavender mt-1">远端密钥找回房间</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <input 
                      type="text" 
                      placeholder="粘贴 Token" 
                      value={logic.restore.state.token}
                      onChange={(e) => logic.restore.setToken(e.target.value)}
                      className="bg-input w-32 h-10 rounded-2xl text-center font-bold text-sm outline-none text-ink placeholder:text-lavender/50"
                    />
                    <button 
                       onClick={() => goExpand('restore')}
                       disabled={!logic.restore.state.token}
                       className="bg-ink text-white w-32 h-10 rounded-2xl font-bold text-sm hover:bg-ink/90 transition-colors active:scale-95 disabled:opacity-50"
                    >
                      检查密钥
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
                <div 
                  key={i} 
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${i === activeIndex ? 'bg-ink scale-125' : 'bg-lavender/30'}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* === State 2: EXPANDED MODE === */}
        {isExpanded && (
          <div className="w-full h-full flex gap-8 animate-fade-in opacity-0" style={{ animationFillMode: 'forwards', animationName: 'fadeIn', animationDuration: '0.3s' }}>
            
            <div className="flex-1 flex flex-col justify-center pl-4">
              
              {/* --- Mode: Create --- */}
              {activeMode === 'create' && (
                <>
                  <span className="inline-block px-3 py-1 rounded-full bg-cream text-ink text-xs font-black tracking-wider w-fit mb-4">
                    {logic.serverMode === 'single' ? 'LAN CANVAS' : 'SERVER ROOM'}
                  </span>
                  <h1 className="text-4xl font-black text-ink mb-2">远端房间</h1>
                  
                  {logic.serverMode === 'single' ? (
                    <>
                      <p className="text-lavender font-bold mb-8">检测到此为局域网分享的单人画布。<br/>点击直接加入协作。</p>
                      <button 
                        onClick={logic.create.join}
                        className="w-full h-14 bg-ink text-white rounded-2xl font-black text-lg shadow-xl shadow-ink/20 hover:translate-y-0.5 transition-transform flex items-center justify-center gap-2 mt-8"
                      >
                        加入局域网画布 <ArrowRight size={20} />
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-lavender font-bold mb-8">输入房间号加入协作，<br/>或生成一个全新的大厅房间。</p>
                      
                      <div className="bg-input rounded-3xl p-2 flex items-center justify-between pl-6 mb-8 pr-2">
                        <input 
                          value={logic.create.roomId}
                          onChange={(e) => logic.create.setRoomId(e.target.value)}
                          className="bg-transparent font-black text-2xl text-ink tracking-widest outline-none w-full"
                          maxLength={8}
                        />
                        <button 
                          onClick={() => logic.create.setRoomId(logic.generateId())}
                          className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-ink shadow-sm hover:scale-105 transition-transform"
                        >
                          <RefreshCw size={20} />
                        </button>
                      </div>

                      <button 
                        onClick={logic.create.join}
                        className="w-full h-14 bg-ink text-white rounded-2xl font-black text-lg shadow-xl shadow-ink/20 hover:translate-y-0.5 transition-transform flex items-center justify-center gap-2"
                      >
                        进入房间 <ArrowRight size={20} />
                      </button>
                      
                      <div className="h-6 mt-2 text-center text-xs font-bold">
                        {logic.create.checkStatus === 'exists' && <span className="text-green-600">此房间已存在，您将加入协作</span>}
                        {logic.create.checkStatus === 'new' && <span className="text-lavender">这是一个新房间</span>}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* --- Mode: Import --- */}
              {activeMode === 'import' && (
                <>
                   <span className="inline-block px-3 py-1 rounded-full bg-[#E5F6FE] text-[#1D5E84] text-xs font-black tracking-wider w-fit mb-4">REMOTE IMPORT</span>
                   <h1 className="text-3xl font-black text-ink mb-2 truncate max-w-md" title={logic.import.state.file?.name}>
                     {logic.import.state.file ? logic.import.state.file.name : '未选择文件'}
                   </h1>
                   <p className="text-lavender font-bold text-sm mb-4">设置远端导入目标房间号</p>
                   
                   <div className="bg-input rounded-3xl p-2 flex items-center justify-between pl-6 mb-4 pr-2">
                    <input 
                      value={logic.create.roomId}
                      onChange={(e) => logic.create.setRoomId(e.target.value)}
                      placeholder="输入或生成房间号"
                      className="bg-transparent font-black text-xl text-ink tracking-widest outline-none w-full"
                      maxLength={8}
                    />
                    <button 
                      onClick={() => logic.create.setRoomId(logic.generateId())}
                      className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-ink shadow-sm hover:scale-105 transition-transform"
                      title="随机生成"
                    >
                      <RefreshCw size={18} />
                    </button>
                  </div>
                  
                  <div className="h-5 mb-3 text-xs font-bold text-center">
                    {logic.create.checkStatus === 'exists' && <span className="text-green-600">✓ 此房间已存在，将覆盖导入</span>}
                    {logic.create.checkStatus === 'new' && <span className="text-lavender">○ 这是一个新房间</span>}
                  </div>
                   
                   <div className="space-y-3 mb-8">
                     {logic.import.state.validation?.valid ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-bold text-green-600 bg-green-50 p-3 rounded-xl">
                            <CheckCircle size={18} />
                            <span>文件结构验证通过</span>
                          </div>
                        </div>
                     ) : (
                        <div className="flex items-center gap-2 text-sm font-bold text-red-500 bg-red-50 p-3 rounded-xl">
                          <AlertTriangle size={18} />
                          <span>{logic.import.state.error || '等待文件...'}</span>
                        </div>
                     )}
                   </div>

                   <button 
                    onClick={() => logic.import.execute(logic.create.roomId || logic.generateId())}
                    disabled={!logic.import.state.validation?.valid || logic.import.state.isImporting}
                    className="w-full h-14 bg-[#1D5E84] text-white rounded-2xl font-black text-lg shadow-xl shadow-[#1D5E84]/20 hover:translate-y-0.5 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {logic.import.state.isImporting ? '导入中...' : '确认导入到服务器'}
                  </button>
                </>
              )}

              {/* --- Mode: Restore --- */}
              {activeMode === 'restore' && (
                <>
                  <span className="inline-block px-3 py-1 rounded-full bg-[#FFF4E5] text-[#FA6400] text-xs font-black tracking-wider w-fit mb-4">REMOTE RESTORE</span>
                  <h1 className="text-4xl font-black text-ink mb-2">Token 验证</h1>
                  <p className="text-lavender font-bold text-sm mb-4">在服务器恢复历史状态</p>
                  
                  <div className="bg-input rounded-3xl p-2 flex items-center justify-between pl-6 mb-4 pr-2">
                    <input 
                      value={logic.create.roomId}
                      onChange={(e) => logic.create.setRoomId(e.target.value)}
                      placeholder="输入或生成房间号"
                      className="bg-transparent font-black text-xl text-ink tracking-widest outline-none w-full"
                      maxLength={8}
                    />
                    <button 
                      onClick={() => logic.create.setRoomId(logic.generateId())}
                      className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-ink shadow-sm hover:scale-105 transition-transform"
                    >
                      <RefreshCw size={18} />
                    </button>
                  </div>
                  
                  <div className="bg-input rounded-3xl p-4 mb-6">
                    <div className="text-[10px] text-lavender uppercase tracking-wider mb-2">Token 内容</div>
                    <p className="font-mono text-xs text-ink break-all line-clamp-3">
                      {logic.restore.state.token}
                    </p>
                  </div>
                  
                  {logic.restore.state.error && (
                    <p className="text-red-500 text-sm font-bold mb-4 flex items-center gap-2">
                       <AlertTriangle size={16} /> {logic.restore.state.error}
                    </p>
                  )}

                  <button 
                    onClick={() => logic.restore.execute(logic.create.roomId || logic.generateId())}
                    disabled={logic.restore.state.isRestoring}
                    className="w-full h-14 bg-[#FA6400] text-white rounded-2xl font-black text-lg shadow-xl shadow-[#FA6400]/20 hover:-translate-y-0.5 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                     <ShieldCheck size={20} />
                    {logic.restore.state.isRestoring ? '恢复中...' : '开始远端恢复'}
                  </button>
                </>
              )}

            </div>

            <div className="w-[320px] bg-[#F8F6FC] rounded-5xl relative overflow-hidden flex items-center justify-center group select-none">
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#827BB9_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                
                <div className={`w-24 h-24 rounded-3xl absolute top-1/4 left-1/4 -rotate-12 shadow-lg group-hover:scale-110 transition-transform duration-500 ${
                  activeMode === 'create' ? 'bg-[#FFD6A5]' : activeMode === 'import' ? 'bg-[#A0C4FF]' : 'bg-[#FFC6FF]'
                }`}></div>
                <div className="w-32 h-20 bg-white rounded-3xl absolute bottom-1/3 right-1/4 rotate-6 shadow-lg group-hover:scale-110 transition-transform duration-500 delay-75"></div>
                
                <div className="absolute bottom-6 left-6 right-6 h-12 bg-white/80 backdrop-blur-md rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-ink shadow-sm overflow-hidden">
                    <Eye size={16} className="shrink-0" />
                    <span className="truncate">节点: {currentApiBase}</span>
                </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
