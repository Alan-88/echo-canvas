/**
 * 图片压缩工具
 * Phase 6: 富媒体支持
 * 
 * 功能：
 * - 客户端压缩图片
 * - 限制最大尺寸（1920px）
 * - 质量控制（0.8）
 * - 大小限制（2MB）
 */

export interface CompressOptions {
  maxWidth?: number;    // 默认1920
  maxHeight?: number;   // 默认1920
  quality?: number;     // 默认0.8
  maxSizeKB?: number;   // 默认2048 (2MB)
}

/**
 * 压缩图片文件为 Base64 字符串
 * @param file 原始图片文件
 * @param options 压缩选项
 * @returns Base64 字符串
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    maxSizeKB = 2048,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          // 1. 计算目标尺寸（保持宽高比）
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          // 2. 创建Canvas进行压缩
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          // 3. 绘制图片到Canvas
          ctx.drawImage(img, 0, 0, width, height);

          // 4. 转为Base64（JPEG格式，压缩效果更好）
          const base64 = canvas.toDataURL('image/jpeg', quality);

          // 5. 检查压缩后大小
          // Base64 大小约为原始字节的 4/3
          const sizeKB = Math.round((base64.length * 3) / 4 / 1024);

          if (sizeKB > maxSizeKB) {
            reject(
              new Error(
                `压缩后图片仍过大: ${sizeKB}KB (限制: ${maxSizeKB}KB)\n` +
                `请尝试使用更小的图片或进一步压缩。`
              )
            );
            return;
          }

          console.log(
            `图片压缩成功: ${img.width}x${img.height} -> ${width}x${height}, ` +
            `大小: ${sizeKB}KB`
          );

          resolve(base64);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 检查文件是否为图片
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * 格式化文件大小显示
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
