/** Frame downsampling for the live path (battery + latency). */

export interface DownsampleSize {
  width: number;
  height: number;
  scale: number;
}

/**
 * Computes the target size so the longest edge is at most `maxEdge`,
 * preserving aspect ratio. Never upscales.
 */
export function computeDownsampleSize(
  width: number,
  height: number,
  maxEdge: number,
): DownsampleSize {
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid source size ${width}x${height}`);
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height, scale: 1 };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

export interface CanvasLike {
  width: number;
  height: number;
  getContext(kind: "2d"): {
    drawImage(
      src: CanvasImageSource,
      x: number,
      y: number,
      w: number,
      h: number,
    ): void;
    getImageData(x: number, y: number, w: number, h: number): ImageData;
  } | null;
}

export type CanvasFactory = (width: number, height: number) => CanvasLike;

const defaultCanvasFactory: CanvasFactory = (width, height) => {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height) as unknown as CanvasLike;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as CanvasLike;
};

/**
 * Draws `source` into a canvas at the downsampled size and returns the
 * RGBA ImageData. `sourceWidth/Height` describe the source's pixel size.
 */
export function downsampleToImageData(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxEdge: number,
  canvasFactory: CanvasFactory = defaultCanvasFactory,
): ImageData {
  const size = computeDownsampleSize(sourceWidth, sourceHeight, maxEdge);
  const canvas = canvasFactory(size.width, size.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");
  ctx.drawImage(source, 0, 0, size.width, size.height);
  return ctx.getImageData(0, 0, size.width, size.height);
}
