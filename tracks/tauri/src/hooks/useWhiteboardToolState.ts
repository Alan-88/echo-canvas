import { useCallback, useMemo, useState } from 'react';

type Tool = 'pen' | 'eraser' | 'select' | 'pan';

interface ToolCursorState {
  isPanning: boolean;
  isSpacePressed: boolean;
  isAltPressed: boolean;
  isRightMousePressed: boolean;
  isDrawing: boolean;
}

interface UseWhiteboardToolCursorOptions {
  tool: Tool;
  penConfig: { color: string; size: number };
  eraserSize: number;
  state: ToolCursorState;
}

const toCursorColor = (hexColor: string) => {
  const hex = hexColor.replace('#', '');
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
};

const buildPenCursor = (color: string, size: number) => {
  const { r, g, b } = toCursorColor(color);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size + 4}" height="${size + 4}" viewBox="0 0 ${size + 4} ${size + 4}">
      <circle cx="${(size + 4) / 2}" cy="${(size + 4) / 2}" r="${size / 2}"
        fill="rgba(${r}, ${g}, ${b}, 0.5)"
        stroke="rgba(${r}, ${g}, ${b}, 0.8)"
        stroke-width="1"/>
    </svg>
  `;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${(size + 4) / 2} ${(size + 4) / 2}, crosshair`;
};

const buildEraserCursor = (size: number) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size + 4}" height="${size + 4}" viewBox="0 0 ${size + 4} ${size + 4}">
      <circle cx="${(size + 4) / 2}" cy="${(size + 4) / 2}" r="${size / 2}"
        fill="rgba(156, 163, 175, 0.3)"
        stroke="rgba(156, 163, 175, 0.6)"
        stroke-width="1"/>
    </svg>
  `;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${(size + 4) / 2} ${(size + 4) / 2}, crosshair`;
};

export const useWhiteboardToolState = () => {
  const [tool, setTool] = useState<Tool>('pen');
  const [currentPopup, setCurrentPopup] = useState<'pen' | 'eraser' | null>(null);

  const handleToolChange = useCallback((newTool: Tool) => {
    setTool(newTool);
    if (newTool === 'pen') {
      setCurrentPopup('pen');
      return;
    }
    if (newTool === 'eraser') {
      setCurrentPopup('eraser');
      return;
    }
    setCurrentPopup(null);
  }, []);

  return {
    tool,
    currentPopup,
    setCurrentPopup,
    handleToolChange,
  };
};

export const useWhiteboardToolCursor = ({
  tool,
  penConfig,
  eraserSize,
  state,
}: UseWhiteboardToolCursorOptions) => {
  const effectiveTool: Tool = useMemo(
    () =>
      tool === 'pen' && state.isRightMousePressed
        ? 'eraser'
        : state.isAltPressed
          ? 'select'
          : state.isSpacePressed
            ? 'pan'
            : tool,
    [state.isAltPressed, state.isRightMousePressed, state.isSpacePressed, tool]
  );

  const cursor = useMemo(() => {
    if (state.isPanning || (state.isSpacePressed && effectiveTool !== 'pan')) {
      return 'grabbing';
    }
    if (state.isSpacePressed || state.isAltPressed) {
      return effectiveTool === 'pan' ? 'grab' : 'default';
    }
    if (effectiveTool === 'pan') {
      return state.isDrawing ? 'grabbing' : 'grab';
    }
    if (effectiveTool === 'pen') {
      return buildPenCursor(penConfig.color, penConfig.size);
    }
    if (effectiveTool === 'eraser') {
      return buildEraserCursor(eraserSize);
    }
    return 'default';
  }, [
    effectiveTool,
    eraserSize,
    penConfig.color,
    penConfig.size,
    state.isAltPressed,
    state.isDrawing,
    state.isPanning,
    state.isSpacePressed,
  ]);

  return {
    effectiveTool,
    cursor,
  };
};
