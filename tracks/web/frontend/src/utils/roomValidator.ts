/**
 * 🛡️ 房间数据验证器 (Room Validator)
 * 
 * 实现三道防线的第一道：前端验证
 * - 文件大小检查
 * - JSON结构深度验证
 * - Base64图片格式验证
 * - 脏数据检测和清理
 * - 统计信息收集
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  info: {
    canvasCount: number;
    totalLayers: number;
    totalShapes: number;
    totalImages: number;
    totalMarkdowns: number;
    largeImages: number; // 超过500KB的图片数量
    estimatedMemory: number; // 预估内存占用（字节）
    originalRoomId: string;
  };
}

export interface SanitizeResult {
  sanitized: any;
  removed: {
    invalidCanvases: number;
    invalidLayers: number;
    invalidActions: number;
    corruptedImages: number;
  };
}

// 文件大小限制（10MB）
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 单张图片大小警告阈值（500KB）
const IMAGE_SIZE_WARNING = 500 * 1024;

// Base64图片正则表达式
const BASE64_IMAGE_REGEX = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;

/**
 * 验证房间快照数据
 */
export function validateRoomSnapshot(snapshot: any, fileSize?: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info = {
    canvasCount: 0,
    totalLayers: 0,
    totalShapes: 0,
    totalImages: 0,
    totalMarkdowns: 0,
    largeImages: 0,
    estimatedMemory: 0,
    originalRoomId: 'unknown',
  };

  // 1. 检查文件大小
  if (fileSize && fileSize > MAX_FILE_SIZE) {
    errors.push(`文件过大：${(fileSize / 1024 / 1024).toFixed(2)}MB（最大支持10MB）`);
    return { valid: false, errors, warnings, info };
  }

  // 2. 检查是否为对象
  if (!snapshot || typeof snapshot !== 'object') {
    errors.push('数据必须是JSON对象');
    return { valid: false, errors, warnings, info };
  }

  // 3. 提取原始房间ID
  if (snapshot.originalRoomId && typeof snapshot.originalRoomId === 'string') {
    info.originalRoomId = snapshot.originalRoomId;
  } else if (snapshot.roomId && typeof snapshot.roomId === 'string') {
    info.originalRoomId = snapshot.roomId;
  }

  // 4. 检查canvases字段
  if (!snapshot.canvases || typeof snapshot.canvases !== 'object') {
    errors.push('缺少canvases字段或格式错误');
    return { valid: false, errors, warnings, info };
  }

  const canvases = snapshot.canvases;
  info.canvasCount = Object.keys(canvases).length;

  if (info.canvasCount === 0) {
    warnings.push('房间为空（没有画布）');
  }

  // 5. 验证每个Canvas
  for (const [canvasId, canvasValue] of Object.entries(canvases)) {
    const canvasResult = validateCanvas(canvasId, canvasValue);
    
    errors.push(...canvasResult.errors);
    warnings.push(...canvasResult.warnings);
    
    info.totalLayers += canvasResult.layerCount;
    info.totalShapes += canvasResult.shapeCount;
    info.totalImages += canvasResult.imageCount;
    info.totalMarkdowns += canvasResult.markdownCount;
    info.largeImages += canvasResult.largeImageCount;
    info.estimatedMemory += canvasResult.estimatedMemory;
  }

  // 6. 最终检查
  if (info.estimatedMemory > 50 * 1024 * 1024) {
    warnings.push(
      `预估内存占用较大：${(info.estimatedMemory / 1024 / 1024).toFixed(2)}MB，可能影响性能`
    );
  }

  if (info.largeImages > 0) {
    warnings.push(`包含${info.largeImages}张大尺寸图片（>500KB），建议压缩后再导入`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info,
  };
}

/**
 * 验证单个Canvas
 */
function validateCanvas(canvasId: string, canvasValue: any): {
  errors: string[];
  warnings: string[];
  layerCount: number;
  shapeCount: number;
  imageCount: number;
  markdownCount: number;
  largeImageCount: number;
  estimatedMemory: number;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let layerCount = 0;
  let shapeCount = 0;
  let imageCount = 0;
  let markdownCount = 0;
  let largeImageCount = 0;
  let estimatedMemory = 0;

  // 检查Canvas是否为对象
  if (!canvasValue || typeof canvasValue !== 'object') {
    errors.push(`Canvas ${canvasId} 必须是对象`);
    return { errors, warnings, layerCount, shapeCount, imageCount, markdownCount, largeImageCount, estimatedMemory };
  }

  // 检查Canvas名称
  if (!canvasValue.name || typeof canvasValue.name !== 'string') {
    warnings.push(`Canvas ${canvasId} 缺少名称`);
  }

  // 检查layers字段
  if (!canvasValue.layers || typeof canvasValue.layers !== 'object') {
    errors.push(`Canvas ${canvasId} 缺少layers字段或格式错误`);
    return { errors, warnings, layerCount, shapeCount, imageCount, markdownCount, largeImageCount, estimatedMemory };
  }

  const layers = canvasValue.layers;
  layerCount = Object.keys(layers).length;

  // 验证每个Layer
  for (const [layerId, layerValue] of Object.entries(layers)) {
    const layerResult = validateLayer(canvasId, layerId, layerValue);
    
    errors.push(...layerResult.errors);
    warnings.push(...layerResult.warnings);
    
    shapeCount += layerResult.shapeCount;
    imageCount += layerResult.imageCount;
    markdownCount += layerResult.markdownCount;
    largeImageCount += layerResult.largeImageCount;
    estimatedMemory += layerResult.estimatedMemory;
  }

  return { errors, warnings, layerCount, shapeCount, imageCount, markdownCount, largeImageCount, estimatedMemory };
}

/**
 * 验证单个Layer
 */
function validateLayer(canvasId: string, layerId: string, layerValue: any): {
  errors: string[];
  warnings: string[];
  shapeCount: number;
  imageCount: number;
  markdownCount: number;
  largeImageCount: number;
  estimatedMemory: number;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let shapeCount = 0;
  let imageCount = 0;
  let markdownCount = 0;
  let largeImageCount = 0;
  let estimatedMemory = 0;

  // 检查Layer是否为对象
  if (!layerValue || typeof layerValue !== 'object') {
    errors.push(`Layer ${layerId} in Canvas ${canvasId} 必须是对象`);
    return { errors, warnings, shapeCount, imageCount, markdownCount, largeImageCount, estimatedMemory };
  }

  // 检查Layer名称
  if (!layerValue.name || typeof layerValue.name !== 'string') {
    warnings.push(`Layer ${layerId} 缺少名称`);
  }

  // 检查actions字段
  if (!layerValue.actions || !Array.isArray(layerValue.actions)) {
    errors.push(`Layer ${layerId} 缺少actions字段或格式错误`);
    return { errors, warnings, shapeCount, imageCount, markdownCount, largeImageCount, estimatedMemory };
  }

  // 检查pointer字段
  if (typeof layerValue.pointer !== 'number') {
    warnings.push(`Layer ${layerId} 的pointer字段缺失或格式错误`);
  }

  // 验证每个Action
  const actions = layerValue.actions;
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const actionResult = validateAction(canvasId, layerId, i, action);
    
    errors.push(...actionResult.errors);
    warnings.push(...actionResult.warnings);
    
    if (actionResult.isDraw) {
      shapeCount++;
      if (actionResult.isImage) {
        imageCount++;
        if (actionResult.isLargeImage) {
          largeImageCount++;
        }
      }
      if (actionResult.isMarkdown) {
        markdownCount++;
      }
      estimatedMemory += actionResult.estimatedSize;
    }
  }

  return { errors, warnings, shapeCount, imageCount, markdownCount, largeImageCount, estimatedMemory };
}

/**
 * 验证单个Action
 */
function validateAction(canvasId: string, layerId: string, index: number, action: any): {
  errors: string[];
  warnings: string[];
  isDraw: boolean;
  isImage: boolean;
  isMarkdown: boolean;
  isLargeImage: boolean;
  estimatedSize: number;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let isDraw = false;
  let isImage = false;
  let isMarkdown = false;
  let isLargeImage = false;
  let estimatedSize = 0;

  // 检查Action是否为对象
  if (!action || typeof action !== 'object') {
    errors.push(`Action #${index} in Layer ${layerId} 必须是对象`);
    return { errors, warnings, isDraw, isImage, isMarkdown, isLargeImage, estimatedSize };
  }

  // 检查type字段
  if (!action.type || typeof action.type !== 'string') {
    errors.push(`Action #${index} in Layer ${layerId} 缺少type字段`);
    return { errors, warnings, isDraw, isImage, isMarkdown, isLargeImage, estimatedSize };
  }

  const actionType = action.type;

  // 验证Draw动作
  if (actionType === 'draw' || actionType === 'Draw') {
    isDraw = true;

    // 检查payload
    if (!action.payload || typeof action.payload !== 'object') {
      errors.push(`Draw action #${index} in Layer ${layerId} 缺少payload`);
      return { errors, warnings, isDraw, isImage, isMarkdown, isLargeImage, estimatedSize };
    }

    const payload = action.payload;

    // 检查id
    if (!payload.id || typeof payload.id !== 'string') {
      warnings.push(`Draw action #${index} in Layer ${layerId} 缺少id`);
    }

    // 检查shape
    if (!payload.shape || typeof payload.shape !== 'object') {
      errors.push(`Draw action #${index} in Layer ${layerId} 缺少shape`);
      return { errors, warnings, isDraw, isImage, isMarkdown, isLargeImage, estimatedSize };
    }

    const shape = payload.shape;

    // 检查shape.type
    if (!shape.type || typeof shape.type !== 'string') {
      errors.push(`Shape in action #${index} 缺少type`);
      return { errors, warnings, isDraw, isImage, isMarkdown, isLargeImage, estimatedSize };
    }

    // 验证Image类型
    if (shape.type === 'image') {
      isImage = true;
      const imageResult = validateImageShape(canvasId, layerId, index, shape.data);
      errors.push(...imageResult.errors);
      warnings.push(...imageResult.warnings);
      isLargeImage = imageResult.isLarge;
      estimatedSize = imageResult.estimatedSize;
    }

    // 验证Markdown类型
    if (shape.type === 'markdown') {
      isMarkdown = true;
      const markdownResult = validateMarkdownShape(canvasId, layerId, index, shape.data);
      errors.push(...markdownResult.errors);
      warnings.push(...markdownResult.warnings);
      estimatedSize = markdownResult.estimatedSize;
    }
  }

  return { errors, warnings, isDraw, isImage, isMarkdown, isLargeImage, estimatedSize };
}

/**
 * 验证Image Shape
 */
function validateImageShape(_canvasId: string, _layerId: string, index: number, data: any): {
  errors: string[];
  warnings: string[];
  isLarge: boolean;
  estimatedSize: number;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let isLarge = false;
  let estimatedSize = 0;

  if (!data || typeof data !== 'object') {
    errors.push(`Image data in action #${index} 格式错误`);
    return { errors, warnings, isLarge, estimatedSize };
  }

  // 检查必需字段
  if (typeof data.x !== 'number' || typeof data.y !== 'number') {
    errors.push(`Image in action #${index} 缺少坐标`);
  }

  if (typeof data.width !== 'number' || typeof data.height !== 'number') {
    errors.push(`Image in action #${index} 缺少尺寸`);
  }

  // 检查src字段（Base64）
  if (!data.src || typeof data.src !== 'string') {
    errors.push(`Image in action #${index} 缺少src字段`);
    return { errors, warnings, isLarge, estimatedSize };
  }

  const src = data.src;

  // 允许空字符串（拖拽优化后的图片）
  if (src === '') {
    return { errors, warnings, isLarge, estimatedSize: 0 };
  }

  // 验证Base64格式
  if (!BASE64_IMAGE_REGEX.test(src)) {
    errors.push(`Image in action #${index} 的src不是有效的Base64图片`);
    return { errors, warnings, isLarge, estimatedSize };
  }

  // 计算图片大小
  const base64Data = src.split(',')[1];
  if (base64Data) {
    estimatedSize = Math.ceil((base64Data.length * 3) / 4); // Base64解码后的大小
    
    if (estimatedSize > IMAGE_SIZE_WARNING) {
      isLarge = true;
    }

    // 超过2MB的图片报错
    if (estimatedSize > 2 * 1024 * 1024) {
      errors.push(
        `Image in action #${index} 过大：${(estimatedSize / 1024 / 1024).toFixed(2)}MB（建议<2MB）`
      );
    }
  }

  return { errors, warnings, isLarge, estimatedSize };
}

/**
 * 验证Markdown Shape
 */
function validateMarkdownShape(_canvasId: string, _layerId: string, index: number, data: any): {
  errors: string[];
  warnings: string[];
  estimatedSize: number;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let estimatedSize = 0;

  if (!data || typeof data !== 'object') {
    errors.push(`Markdown data in action #${index} 格式错误`);
    return { errors, warnings, estimatedSize };
  }

  // 检查必需字段
  if (typeof data.x !== 'number' || typeof data.y !== 'number') {
    errors.push(`Markdown in action #${index} 缺少坐标`);
  }

  if (typeof data.width !== 'number' || typeof data.height !== 'number') {
    errors.push(`Markdown in action #${index} 缺少尺寸`);
  }

  // 检查content字段
  if (typeof data.content !== 'string') {
    errors.push(`Markdown in action #${index} 缺少content字段`);
  } else {
    estimatedSize += data.content.length;
  }

  // 检查renderedImage字段
  if (!data.renderedImage || typeof data.renderedImage !== 'string') {
    warnings.push(`Markdown in action #${index} 缺少renderedImage`);
  } else if (data.renderedImage !== '') {
    // 验证Base64格式
    if (!BASE64_IMAGE_REGEX.test(data.renderedImage)) {
      warnings.push(`Markdown in action #${index} 的renderedImage不是有效的Base64图片`);
    } else {
      const base64Data = data.renderedImage.split(',')[1];
      if (base64Data) {
        estimatedSize += Math.ceil((base64Data.length * 3) / 4);
      }
    }
  }

  return { errors, warnings, estimatedSize };
}

/**
 * 清理和修复房间快照数据
 */
export function sanitizeRoomSnapshot(snapshot: any): SanitizeResult {
  const removed = {
    invalidCanvases: 0,
    invalidLayers: 0,
    invalidActions: 0,
    corruptedImages: 0,
  };

  // 创建深拷贝
  const sanitized = JSON.parse(JSON.stringify(snapshot));

  // 确保canvases存在
  if (!sanitized.canvases || typeof sanitized.canvases !== 'object') {
    sanitized.canvases = {};
    return { sanitized, removed };
  }

  // 清理每个Canvas
  for (const [canvasId, canvasValue] of Object.entries(sanitized.canvases)) {
    if (!canvasValue || typeof canvasValue !== 'object') {
      delete sanitized.canvases[canvasId];
      removed.invalidCanvases++;
      continue;
    }

    const canvas: any = canvasValue;

    // 确保Canvas有名称
    if (!canvas.name || typeof canvas.name !== 'string') {
      canvas.name = `Canvas ${canvasId.slice(0, 8)}`;
    }

    // 确保layers存在
    if (!canvas.layers || typeof canvas.layers !== 'object') {
      canvas.layers = {};
      continue;
    }

    // 清理每个Layer
    for (const [layerId, layerValue] of Object.entries(canvas.layers)) {
      if (!layerValue || typeof layerValue !== 'object') {
        delete canvas.layers[layerId];
        removed.invalidLayers++;
        continue;
      }

      const layer: any = layerValue;

      // 确保Layer有名称
      if (!layer.name || typeof layer.name !== 'string') {
        layer.name = `Layer ${layerId.slice(0, 8)}`;
      }

      // 确保actions存在
      if (!layer.actions || !Array.isArray(layer.actions)) {
        layer.actions = [];
        layer.pointer = 0;
        continue;
      }

      // 清理每个Action
      const validActions = [];
      for (const action of layer.actions) {
        if (!action || typeof action !== 'object' || !action.type) {
          removed.invalidActions++;
          continue;
        }

        // 清理Draw动作
        if (action.type === 'draw' || action.type === 'Draw') {
          if (!action.payload || !action.payload.shape) {
            removed.invalidActions++;
            continue;
          }

          // 清理损坏的Image
          if (action.payload.shape.type === 'image') {
            const data = action.payload.shape.data;
            if (data && data.src && data.src !== '') {
              if (!BASE64_IMAGE_REGEX.test(data.src)) {
                removed.corruptedImages++;
                continue; // 跳过损坏的图片
              }
            }
          }
        }

        validActions.push(action);
      }

      layer.actions = validActions;

      // 修复pointer
      if (typeof layer.pointer !== 'number' || layer.pointer < 0) {
        layer.pointer = validActions.length;
      } else if (layer.pointer > validActions.length) {
        layer.pointer = validActions.length;
      }
    }
  }

  return { sanitized, removed };
}

/**
 * 估算JSON字符串的大小
 */
export function estimateJSONSize(obj: any): number {
  try {
    return JSON.stringify(obj).length;
  } catch {
    return 0;
  }
}
