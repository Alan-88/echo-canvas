export interface ExportRasterScaleOptions {
  contentWidth: number;
  contentHeight: number;
  pixelRatio?: number;
  maxPixels?: number;
}

export interface ExportRasterScale {
  pixelRatio: number;
  rasterWidth: number;
  rasterHeight: number;
  capped: boolean;
}

export interface ExportEmptySize {
  width: number;
  height: number;
}

export const DEFAULT_EXPORT_PADDING = 20;
export const DEFAULT_EXPORT_BACKGROUND = 'white';
export const DEFAULT_EXPORT_PIXEL_RATIO = 2;
export const DEFAULT_EXPORT_MAX_PIXELS = 16_777_216; // 16 MP
export const DEFAULT_EXPORT_EMPTY_SIZE: ExportEmptySize = {
  width: 1920,
  height: 1080,
};

const clampSize = (value: number) => Math.max(1, Number.isFinite(value) ? value : 1);

const clampRatio = (value: number) => Math.max(0.01, Number.isFinite(value) ? value : 1);

export const resolveExportRasterScale = ({
  contentWidth,
  contentHeight,
  pixelRatio = DEFAULT_EXPORT_PIXEL_RATIO,
  maxPixels = DEFAULT_EXPORT_MAX_PIXELS,
}: ExportRasterScaleOptions): ExportRasterScale => {
  const safeWidth = clampSize(contentWidth);
  const safeHeight = clampSize(contentHeight);
  const desiredRatio = clampRatio(pixelRatio);
  const safeMaxPixels = Math.max(1, Number.isFinite(maxPixels) ? maxPixels : DEFAULT_EXPORT_MAX_PIXELS);
  const maxRatio = Math.sqrt(safeMaxPixels / (safeWidth * safeHeight));
  const resolvedRatio = Math.min(desiredRatio, clampRatio(maxRatio));

  return {
    pixelRatio: resolvedRatio,
    rasterWidth: Math.max(1, Math.ceil(safeWidth * resolvedRatio)),
    rasterHeight: Math.max(1, Math.ceil(safeHeight * resolvedRatio)),
    capped: resolvedRatio + 1e-6 < desiredRatio,
  };
};

export const waitForExportAssets = (delayMs = 50) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
