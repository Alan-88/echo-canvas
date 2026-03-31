/**
 * 剪贴板工具
 * 兼容多种浏览器的复制方法
 */

interface ClipboardWriteOptions {
  text: string;
  whiteboardSelectionText?: string | null;
  whiteboardSelectionMime?: string;
}

interface ClipboardReadOptions {
  whiteboardSelectionMime?: string;
}

interface ClipboardReadResult {
  text: string | null;
  whiteboardSelectionText: string | null;
}

export const writeClipboardData = async ({
  text,
  whiteboardSelectionText,
  whiteboardSelectionMime = 'text/x-whiteboard-selection',
}: ClipboardWriteOptions): Promise<boolean> => {
  try {
    if (
      navigator.clipboard &&
      window.isSecureContext &&
      typeof ClipboardItem !== 'undefined'
    ) {
      const clipboardItemData: Record<string, Blob> = {
        'text/plain': new Blob([text], { type: 'text/plain' }),
      };

      if (whiteboardSelectionText) {
        clipboardItemData[whiteboardSelectionMime] = new Blob([whiteboardSelectionText], {
          type: whiteboardSelectionMime,
        });
      }

      await navigator.clipboard.write([new ClipboardItem(clipboardItemData)]);
      return true;
    }
  } catch (err) {
    console.log('ClipboardItem 写入失败，尝试降级方案', err);
  }

  return copyToClipboard(text);
};

export const readClipboardData = async ({
  whiteboardSelectionMime = 'text/x-whiteboard-selection',
}: ClipboardReadOptions = {}): Promise<ClipboardReadResult> => {
  try {
    if (
      navigator.clipboard &&
      window.isSecureContext &&
      typeof navigator.clipboard.read === 'function'
    ) {
      const items = await navigator.clipboard.read();
      let text: string | null = null;
      let whiteboardSelectionText: string | null = null;

      for (const item of items) {
        if (!whiteboardSelectionText && item.types.includes(whiteboardSelectionMime)) {
          const blob = await item.getType(whiteboardSelectionMime);
          whiteboardSelectionText = await blob.text();
        }
        if (!text && item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          text = await blob.text();
        }
      }

      if (text !== null || whiteboardSelectionText !== null) {
        return { text, whiteboardSelectionText };
      }
    }
  } catch (err) {
    console.log('Clipboard read() 失败，尝试降级方案', err);
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      const text = await navigator.clipboard.readText();
      return {
        text,
        whiteboardSelectionText: null,
      };
    }
  } catch (err) {
    console.log('Clipboard readText() 失败', err);
  }

  return {
    text: null,
    whiteboardSelectionText: null,
  };
};

/**
 * 将文本复制到剪贴板
 * 优先使用现代 Clipboard API，降级到 execCommand
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  // 方案1: 现代 Clipboard API
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.log('Clipboard API 失败，尝试降级方案', err);
  }

  // 方案2: 降级方案 - execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('所有复制方案都失败:', err);
    return false;
  }
};
