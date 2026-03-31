/**
 * 绘图工具配置 Hook
 * 管理画笔和橡皮擦的配置状态，已完全绑定到绘图逻辑
 */

import { useState } from 'react';

export interface PenConfig {
  color: string;
  size: number;
}

export interface DrawingToolsState {
  penConfig: PenConfig;
  eraserSize: number;
  setPenColor: (color: string) => void;
  setPenSize: (size: number) => void;
  setEraserSize: (size: number) => void;
}

export const useDrawingTools = (): DrawingToolsState => {
  const [penConfig, setPenConfig] = useState<PenConfig>({
    color: '#ef4444', // 红色
    size: 6, // 中等粗细
  });

  const [eraserSize, setEraserSize] = useState<number>(15); // 中等粗细

  const setPenColor = (color: string) => {
    setPenConfig((prev) => ({ ...prev, color }));
  };

  const setPenSize = (size: number) => {
    setPenConfig((prev) => ({ ...prev, size }));
  };

  return {
    penConfig,
    eraserSize,
    setPenColor,
    setPenSize,
    setEraserSize,
  };
};
