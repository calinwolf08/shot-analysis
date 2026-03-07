/**
 * Browser-based video element frame provider.
 *
 * This provider extracts frames from video files loaded into an HTML video element.
 * It uses a canvas to capture frame data, making it suitable for browser environments.
 *
 * @example
 * ```typescript
 * // Create from a File object (from file input)
 * const file = fileInput.files[0];
 * const provider = await createVideoElementProvider(file);
 *
 * // Or create from a video URL
 * const provider = await createVideoElementProvider('/videos/shot.mp4');
 *
 * // Use like any other FrameProvider
 * const analyzer = await createShotAnalyzer(config);
 * const result = await analyzer.analyzeVideo(provider);
 * ```
 */

import type { FrameProvider, VideoFrame, FrameMetadata } from "./types";

/**
 * Error thrown when the video cannot be loaded.
 */
export class VideoLoadError extends Error {
  constructor(message: string) {
    super(`Failed to load video: ${message}`);
    this.name = "VideoLoadError";
  }
}

/**
 * Options for creating a VideoElementProvider.
 */
export interface VideoElementProviderOptions {
  /**
   * Target frames per second for frame extraction.
   * Default: auto-detect from video metadata, or 30 if unknown.
   */
  fps?: number;
}

/**
 * Frame provider that extracts frames from an HTML video element.
 *
 * This provider is designed for browser environments where video files
 * are loaded from user uploads or URLs. It uses a canvas element to
 * capture RGBA frame data at the specified frame rate.
 */
export class VideoElementProvider implements FrameProvider {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentFrame: number = 0;
  private totalFrames: number;
  private frameDuration: number;
  private _fps: number;
  private _metadata: FrameMetadata;
  private constructor(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    fps: number,
  ) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = ctx;
    this._fps = fps;
    this.frameDuration = 1 / fps;

    // Calculate total frames from duration
    this.totalFrames = Math.floor(video.duration * fps);

    this._metadata = {
      width: video.videoWidth,
      height: video.videoHeight,
      duration: video.duration * 1000, // Convert to milliseconds
    };

    // Set canvas dimensions to match video
    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;
  }

  /**
   * Creates a VideoElementProvider from a video source.
   *
   * @param source - A File object, Blob, or URL string pointing to the video
   * @param options - Optional configuration for frame extraction
   * @returns A promise that resolves to the initialized provider
   * @throws {VideoLoadError} If the video cannot be loaded
   */
  static async create(
    source: File | Blob | string,
    options: VideoElementProviderOptions = {},
  ): Promise<VideoElementProvider> {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;

    // Create object URL for File/Blob sources
    const url = source instanceof Blob ? URL.createObjectURL(source) : source;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
      };

      const onLoaded = async () => {
        cleanup();

        // Wait for video to be fully seekable
        if (video.readyState < 2) {
          await new Promise<void>((res) => {
            video.addEventListener("canplay", () => res(), { once: true });
          });
        }

        // Create canvas for frame extraction
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          reject(new VideoLoadError("Could not create canvas context"));
          return;
        }

        // Determine FPS (default to 30 if not specified)
        const fps = options.fps ?? 30;

        // Seek to start
        video.currentTime = 0;
        await new Promise<void>((res) => {
          video.addEventListener("seeked", () => res(), { once: true });
        });

        resolve(new VideoElementProvider(video, canvas, ctx, fps));
      };

      const onError = () => {
        cleanup();
        reject(
          new VideoLoadError(video.error?.message ?? "Unknown video error"),
        );
      };

      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);

      video.src = url;
      video.load();
    });
  }

  /**
   * Retrieves the next frame from the video.
   *
   * @returns The next frame, or null if all frames have been extracted
   */
  async getNextFrame(): Promise<VideoFrame | null> {
    if (this.currentFrame >= this.totalFrames) {
      return null;
    }

    // Calculate target time for this frame
    const targetTime = this.currentFrame * this.frameDuration;

    // Seek to the target time if needed
    if (Math.abs(this.video.currentTime - targetTime) > 0.001) {
      this.video.currentTime = targetTime;
      await new Promise<void>((resolve) => {
        this.video.addEventListener("seeked", () => resolve(), { once: true });
      });
    }

    // Draw the current frame to canvas
    this.ctx.drawImage(this.video, 0, 0);

    // Extract pixel data
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );

    const frame: VideoFrame = {
      data: imageData.data,
      width: this.canvas.width,
      height: this.canvas.height,
      timestamp: targetTime * 1000, // Convert to milliseconds
      frameIndex: this.currentFrame,
      canvas: this.canvas, // Include canvas for direct MediaPipe use
    };

    this.currentFrame++;
    return frame;
  }

  /**
   * Returns the frames per second of the video.
   */
  getFps(): number {
    return this._fps;
  }

  /**
   * Returns metadata about the video.
   */
  getMetadata(): FrameMetadata {
    return this._metadata;
  }

  /**
   * Returns the total number of frames in the video.
   */
  getTotalFrames(): number {
    return this.totalFrames;
  }

  /**
   * Resets the provider to the beginning of the video.
   */
  async reset(): Promise<void> {
    this.currentFrame = 0;
    this.video.currentTime = 0;
    await new Promise<void>((resolve) => {
      this.video.addEventListener("seeked", () => resolve(), { once: true });
    });
  }

  /**
   * Releases resources held by this provider.
   */
  dispose(): void {
    // Revoke object URL if we created one
    if (this.video.src.startsWith("blob:")) {
      URL.revokeObjectURL(this.video.src);
    }
    this.video.src = "";
    this.video.load();
  }
}

/**
 * Creates a VideoElementProvider from a video source.
 *
 * This is a convenience function for creating a VideoElementProvider.
 *
 * @param source - A File object, Blob, or URL string pointing to the video
 * @param options - Optional configuration for frame extraction
 * @returns A promise that resolves to the initialized provider
 */
export async function createVideoElementProvider(
  source: File | Blob | string,
  options?: VideoElementProviderOptions,
): Promise<VideoElementProvider> {
  return VideoElementProvider.create(source, options);
}
