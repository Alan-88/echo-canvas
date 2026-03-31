import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import html2canvas from 'html2canvas';
import 'katex/dist/katex.min.css';

interface RenderOptions {
  maxWidth?: number;
  maxHeight?: number;
  backgroundColor?: string;
  padding?: number;
}

/**
 * 将Markdown渲染为PNG图片
 * @param content Markdown源码
 * @param options 渲染选项
 * @returns PNG DataURL、宽度和高度
 */
export async function renderMarkdownToPNG(
  content: string,
  options: RenderOptions = {}
): Promise<{ dataURL: string; width: number; height: number }> {
  const {
    maxWidth = 600,
    maxHeight,
    backgroundColor = 'transparent',
    padding = 16,
  } = options;

  // 创建临时容器
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${maxWidth}px`;
  if (typeof maxHeight === 'number') {
    container.style.height = `${maxHeight}px`;
    container.style.overflow = 'hidden';
  }
  container.style.padding = `${padding}px`;
  container.style.backgroundColor = backgroundColor;
  container.style.boxSizing = 'border-box';
  
  // 直接内联样式，而不依赖CSS类
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  container.style.fontSize = '16px';
  container.style.lineHeight = '1.6';
  container.style.color = '#24292e';
  container.style.whiteSpace = 'normal';
  container.style.overflowWrap = 'anywhere';
  container.style.wordBreak = 'break-word';
  
  document.body.appendChild(container);

  try {
    // 渲染React组件到容器
    const root = await import('react-dom/client').then(m => m.createRoot(container));
    
    await new Promise<void>((resolve) => {
      root.render(
        React.createElement(ReactMarkdown, {
          children: content,
          remarkPlugins: [remarkBreaks, remarkMath],
          rehypePlugins: [rehypeKatex],
        })
      );
      // 等待渲染完成
      setTimeout(resolve, 200);
    });

    // 等待LaTeX公式渲染
    await waitForKatex(container);

    // 应用内联样式到所有子元素
    applyStylesToChildren(container);

    // 使用html2canvas转换为canvas
    const canvas = await html2canvas(container, {
      backgroundColor,
      scale: 2, // 提高清晰度
      useCORS: true,
      logging: false,
      allowTaint: true,
      foreignObjectRendering: false,
    });

    // 获取实际尺寸
    const width = canvas.width / 2; // 除以scale
    const height = canvas.height / 2;

    // 转换为PNG DataURL
    const dataURL = canvas.toDataURL('image/png');

    // 清理
    root.unmount();
    document.body.removeChild(container);

    return { dataURL, width, height };
  } catch (error) {
    // 清理
    document.body.removeChild(container);
    throw new Error(`Failed to render Markdown: ${error}`);
  }
}

/**
 * 应用样式到所有子元素
 */
function applyStylesToChildren(element: HTMLElement) {
  const textBlocks = element.querySelectorAll('p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6');
  textBlocks.forEach((node) => {
    const el = node as HTMLElement;
    el.style.whiteSpace = 'normal';
    el.style.overflowWrap = 'anywhere';
    el.style.wordBreak = 'break-word';
  });

  // 为常见Markdown元素应用样式
  const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headings.forEach((h, index) => {
    const el = h as HTMLElement;
    el.style.fontWeight = 'bold';
    el.style.marginTop = index === 0 ? '0' : '24px';
    el.style.marginBottom = '16px';
    
    if (h.tagName === 'H1') el.style.fontSize = '2em';
    else if (h.tagName === 'H2') el.style.fontSize = '1.5em';
    else if (h.tagName === 'H3') el.style.fontSize = '1.25em';
  });

  const paragraphs = element.querySelectorAll('p');
  paragraphs.forEach(p => {
    const el = p as HTMLElement;
    el.style.marginTop = '0';
    el.style.marginBottom = '16px';
  });

  const lists = element.querySelectorAll('ul, ol');
  lists.forEach(list => {
    const el = list as HTMLElement;
    el.style.paddingLeft = '2em';
    el.style.marginTop = '0';
    el.style.marginBottom = '16px';
  });

  const strong = element.querySelectorAll('strong');
  strong.forEach(s => {
    const el = s as HTMLElement;
    el.style.fontWeight = 'bold';
  });

  const em = element.querySelectorAll('em');
  em.forEach(e => {
    const el = e as HTMLElement;
    el.style.fontStyle = 'italic';
  });

  const code = element.querySelectorAll('code');
  code.forEach(c => {
    const el = c as HTMLElement;
    el.style.backgroundColor = '#f6f8fa';
    el.style.padding = '0.2em 0.4em';
    el.style.borderRadius = '3px';
    el.style.fontFamily = 'monospace';
    el.style.fontSize = '85%';
    el.style.whiteSpace = 'pre-wrap';
    el.style.overflowWrap = 'anywhere';
    el.style.wordBreak = 'break-word';
  });

  const pre = element.querySelectorAll('pre');
  pre.forEach(p => {
    const el = p as HTMLElement;
    el.style.backgroundColor = '#f6f8fa';
    el.style.padding = '16px';
    el.style.borderRadius = '6px';
    el.style.overflow = 'hidden';
    el.style.whiteSpace = 'pre-wrap';
    el.style.overflowWrap = 'anywhere';
    el.style.wordBreak = 'break-word';
  });
}

/**
 * 等待KaTeX公式渲染完成
 */
async function waitForKatex(container: HTMLElement): Promise<void> {
  const maxWait = 2000; // 最多等待2秒
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const katexElements = container.querySelectorAll('.katex');
    const allRendered = Array.from(katexElements).every(el => {
      return el.querySelector('.katex-html') !== null;
    });

    if (katexElements.length === 0 || allRendered) {
      // 再等一小会儿确保完全渲染
      await new Promise(resolve => setTimeout(resolve, 50));
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
