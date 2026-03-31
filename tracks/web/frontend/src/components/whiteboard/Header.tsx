/**
 * 白板顶部工具栏
 * 包含工具选择、操作按钮、Canvas 名称按钮
 */

import { Menu, Hand, Pencil, Eraser, Type, Image, Undo2, Redo2, Trash2, Layout } from 'lucide-react';
import { useWhiteboardStore, canUndo, canRedo } from '../../store/useWhiteboardStore';
import { SelectionModeToolbarMenu } from './SelectionModeToolbarMenu';

type Tool = 'pen' | 'eraser' | 'select' | 'pan';

interface HeaderProps {
  // 当前工具
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  
  // 插入操作
  onInsertMarkdown: () => void;
  onInsertImage: () => void;
  
  // Popup 状态
  currentPopup: 'pen' | 'eraser' | null;
  onPopupToggle: (popup: 'pen' | 'eraser' | null) => void;
  
  // 画笔配置（用于显示指示器和Popup）
  penConfig: { color: string; size: number };
  eraserSize: number;
  onPenColorChange: (color: string) => void;
  onPenSizeChange: (size: number) => void;
  onEraserSizeChange: (size: number) => void;
  
  // 操作
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  
  // Canvas 名称
  currentCanvasName: string;
  onCanvasNameClick: () => void;
  
  // 侧边栏
  onLeftSidebarToggle: () => void;
  tokenState: 'unsaved' | 'syncing' | 'synced';
}

// 颜色选项
const COLORS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#342E55', label: 'Ink' },
  { value: '#3b82f6', label: 'Blue' },
];

// 画笔粗细选项
const PEN_SIZES = [
  { value: 3, dotClass: 'w-1.5 h-1.5' },
  { value: 6, dotClass: 'w-2.5 h-2.5' },
  { value: 12, dotClass: 'w-4 h-4' },
];

// 橡皮擦粗细选项
const ERASER_SIZES = [
  { value: 10, dotClass: 'w-2.5 h-2.5' },
  { value: 15, dotClass: 'w-3.5 h-3.5' },
  { value: 25, dotClass: 'w-5 h-5' },
];

export const Header: React.FC<HeaderProps> = ({
  tool,
  onToolChange,
  currentPopup,
  onPopupToggle,
  penConfig,
  eraserSize,
  onPenColorChange,
  onPenSizeChange,
  onEraserSizeChange,
  onUndo,
  onRedo,
  onClear,
  currentCanvasName,
  onCanvasNameClick,
  onLeftSidebarToggle,
  tokenState,
  onInsertMarkdown,
  onInsertImage,
}) => {
  // Undo/Redo 状态
  const canUndoState = useWhiteboardStore(canUndo);
  const canRedoState = useWhiteboardStore(canRedo);
  
  const handleToolClick = (selectedTool: Tool, hasPopup?: 'pen' | 'eraser') => {
    if (tool === selectedTool && hasPopup) {
      // 如果当前工具已选中，再次点击切换 popup
      onPopupToggle(currentPopup === hasPopup ? null : hasPopup);
    } else {
      // 切换工具，但不立即显示popup
      onToolChange(selectedTool);
      onPopupToggle(null);
    }
  };

  const getToolClasses = (selectedTool: Tool) => {
    const isActive = tool === selectedTool;
    return `tool-btn w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${
      isActive ? 'tool-btn-active' : 'text-lavender hover:bg-hover hover:text-ink'
    }`;
  };

  return (
    <header className="absolute top-6 left-0 right-0 flex justify-center items-start z-50 pointer-events-none">
      <div className="w-full max-w-[95%] flex justify-between items-start pointer-events-auto">
        {/* 左侧：菜单按钮 */}
        <div className="bg-panel rounded-2xl shadow-xl border border-white/50 p-1.5 flex items-center gap-2 transition-all hover:scale-[1.02]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLeftSidebarToggle();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-lavender hover:bg-hover hover:text-ink transition-colors relative"
            title="菜单"
          >
            <Menu className="w-5 h-5" />
            {tokenState === 'unsaved' && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-[#FA6400] rounded-full border-2 border-white"></div>
            )}
          </button>
        </div>

        {/* 中间：工具栏 */}
        <div className="bg-panel rounded-2xl shadow-xl border border-white/50 px-3 py-2 flex items-center gap-2 mx-4">
          {/* Select / Pan */}
          <div className="flex gap-1">
            <SelectionModeToolbarMenu
              isSelectToolActive={tool === 'select'}
              onSelectToolActivate={() => handleToolClick('select')}
              buttonClassName={getToolClasses('select')}
            />
            <button
              onClick={() => handleToolClick('pan')}
              className={getToolClasses('pan')}
              title="拖拽画布 (H)"
            >
              <Hand className="w-5 h-5" />
            </button>
          </div>

          <div className="w-px h-6 bg-border mx-1"></div>

          {/* Pen / Eraser / Markdown / Image */}
          <div className="flex gap-1 relative">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToolClick('pen', 'pen');
                }}
                className={getToolClasses('pen')}
                title="画笔 (P)"
              >
                <Pencil className="w-5 h-5" />
                {/* 画笔颜色指示器 */}
                <div
                  className="absolute bottom-1.5 right-1.5 rounded-full border border-white shadow-sm transition-all"
                  style={{
                    width: `${penConfig.size}px`,
                    height: `${penConfig.size}px`,
                    backgroundColor: penConfig.color,
                  }}
                ></div>
              </button>
              
              {/* Pen Popup */}
              <div
                className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-2 p-3 bg-white rounded-2xl shadow-xl border border-white/50 flex items-center gap-3 z-50 origin-top transition-all duration-200 ${
                  currentPopup === 'pen'
                    ? 'opacity-100 translate-y-0 scale-100 visible'
                    : 'opacity-0 -translate-y-2 scale-95 invisible pointer-events-none'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Color Selector */}
                <div className="flex gap-2 border-r border-[#E0D8F0] pr-3">
                  {COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => onPenColorChange(color.value)}
                      className={`w-7 h-7 rounded-full shadow-sm transition-all duration-200 border-2 ${
                        penConfig.color === color.value
                          ? 'border-ink scale-110'
                          : 'border-transparent hover:scale-110'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>

                {/* Size Selector */}
                <div className="flex gap-2 items-center">
                  {PEN_SIZES.map((size) => (
                    <button
                      key={size.value}
                      onClick={() => onPenSizeChange(size.value)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        penConfig.size === size.value
                          ? 'bg-input'
                          : 'hover:bg-input opacity-50'
                      }`}
                      title={`Size ${size.value}`}
                    >
                      <div className={`${size.dotClass} bg-ink rounded-full`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToolClick('eraser', 'eraser');
                }}
                className={getToolClasses('eraser')}
                title="橡皮擦 (E)"
              >
                <Eraser className="w-5 h-5" />
                {/* 橡皮擦大小指示器 */}
                <div
                  className="absolute bottom-1.5 right-1.5 rounded-full border border-white shadow-sm transition-all"
                  style={{
                    width: `${eraserSize}px`,
                    height: `${eraserSize}px`,
                    backgroundColor: 'rgba(156, 163, 175, 0.5)', // 半透明灰色
                  }}
                ></div>
              </button>
              
              {/* Eraser Popup */}
              <div
                className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-2 p-3 bg-white rounded-2xl shadow-xl border border-white/50 w-48 flex items-center gap-3 justify-center z-50 origin-top transition-all duration-200 ${
                  currentPopup === 'eraser'
                    ? 'opacity-100 translate-y-0 scale-100 visible'
                    : 'opacity-0 -translate-y-2 scale-95 invisible pointer-events-none'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Size Selector */}
                {ERASER_SIZES.map((size) => (
                  <button
                    key={size.value}
                    onClick={() => onEraserSizeChange(size.value)}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                      eraserSize === size.value
                        ? 'bg-input'
                        : 'hover:bg-input opacity-50'
                    }`}
                    title={`Size ${size.value}`}
                  >
                    <div className={`${size.dotClass} bg-gray-400 rounded-full`} />
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={onInsertMarkdown}
              className="tool-btn w-10 h-10 rounded-xl flex items-center justify-center text-lavender transition-all hover:bg-hover hover:text-ink"
              title="插入文本"
            >
              <Type className="w-5 h-5" />
            </button>
            <button
              onClick={onInsertImage}
              className="tool-btn w-10 h-10 rounded-xl flex items-center justify-center text-lavender transition-all hover:bg-hover hover:text-ink"
              title="插入图片"
            >
              <Image className="w-5 h-5" />
            </button>
          </div>

          <div className="w-px h-6 bg-border mx-1"></div>

          {/* Undo / Redo / Clear */}
          <div className="flex gap-1">
            <button
              onClick={onUndo}
              disabled={!canUndoState}
              className={`tool-btn w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                canUndoState
                  ? 'text-lavender hover:bg-hover hover:text-ink'
                  : 'text-lavender/30 cursor-not-allowed'
              }`}
              title="撤销 (Ctrl+Z)"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedoState}
              className={`tool-btn w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                canRedoState
                  ? 'text-lavender hover:bg-hover hover:text-ink'
                  : 'text-lavender/30 cursor-not-allowed'
              }`}
              title="重做 (Ctrl+Y)"
            >
              <Redo2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClear}
              className="tool-btn w-10 h-10 rounded-xl flex items-center justify-center text-red-400 transition-all hover:bg-red-50 hover:text-red-500 ml-1"
              title="清空当前图层"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 右侧：Canvas 名称按钮 */}
        <div className="bg-panel rounded-2xl shadow-xl border border-white/50 p-1.5 flex items-center gap-2 transition-all hover:scale-[1.02]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCanvasNameClick();
            }}
            className="px-4 py-2 hover:bg-hover rounded-xl text-sm font-bold text-ink flex items-center gap-2 transition-all"
          >
            <span>{currentCanvasName}</span>
            <Layout className="w-4 h-4 text-lavender" />
          </button>
        </div>
      </div>

      <style>{`
        .tool-btn-active {
          background-color: #342E55 !important;
          color: white !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          transform: translateY(-1px);
        }
      `}</style>
    </header>
  );
};
