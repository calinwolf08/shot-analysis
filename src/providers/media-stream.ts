/**
 * Media stream provider for the basketball shot analysis module.
 *
 * This module provides a FrameProvider implementation that extracts frames
 * from live MediaStream sources (browser camera feeds).
 *
 * Browser-only implementation using canvas for frame extraction.
 *
 * ## Known Limitations
 *
 * - Requires browser environment with HTMLVideoElement and Canvas2D support
 * - Frame rate limiting is approximate due to browser event loop timing
 * - Memory management relies on garbage collection of canvas ImageData objects
 *
 * ## Future Improvements
 *
 * - Add OffscreenCanvas support for web worker frame extraction
 * - Implement adaptive frame rate based on processing speed
 * - Add WebCodecs API support for more efficient video decoding
 */

import type { FrameProvider, VideoFrame, FrameMetadata } from "./types";

/**
 * Error thrown when the media stream has ended unexpectedly.
 */
export class MediaStreamEndedError extends Error {
  constructor() {
    super("Media stream has ended unexpectedly");
    this.name = "MediaStreamEndedError";
  }
}

/**
 * Error thrown when the media stream is inactive.
 */
export class MediaStreamInactiveError extends Error {
  constructor() {
    super("Media stream is inactive");
    this.name = "MediaStreamInactiveError";
  }
}

/**
 * Error thrown when the media stream has no video track.
 */
export class NoVideoTrackError extends Error {
  constructor() {
    super("Media stream has no video track");
    this.name = "NoVideoTrackError";
  }
}

/**
 * Options for creating a MediaStreamProvider.
 */
export interface MediaStreamProviderOptions {
  /**
   * Target frame rate for frame extraction.
   * If not specified, uses the stream's native frame rate.
   */
  fps?: number;
}

/**
 * FrameProvider implementation for browser MediaStream sources.
 *
 * Extracts frames from live camera feeds using canvas-based capture.
 * Supports configurable frame rate limiting to reduce CPU usage.
 *
 * @example
 * ```typescript
 * const stream = await navigator.mediaDevices.getUserMedia({ video: true });
 * const provider = await createMediaStreamProvider(stream, { fps: 30 });
 *
 * const metadata = provider.getMetadata();
 * console.log(`Video: ${metadata.width}x${metadata.height}`);
 *
 * let frame = await provider.getNextFrame();
 * while (frame !== null) {
 *   // Process frame
 *   frame = await provider.getNextFrame();
 * }
 *
 * provider.dispose();
 * ```
 */
export class MediaStreamProvider implements FrameProvider {
  private readonly stream: MediaStream;
  private readonly videoElement: HTMLVideoElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly fps: number;
  private readonly frameInterval: number;
  private readonly width: number;
  private readonly height: number;

  private currentFrameIndex: number = 0;
  private disposed: boolean = false;
  private streamEnded: boolean = false;

  /**
   * Private constructor. Use createMediaStreamProvider() factory function.
   */
  private constructor(
    stream: MediaStream,
    videoElement: HTMLVideoElement,
    context: CanvasRenderingContext2D,
    fps: number,
    width: number,
    height: number,
  ) {
    this.stream = stream;
    this.videoElement = videoElement;
    this.context = context;
    this.fps = fps;
    this.frameInterval = 1000 / fps;
    this.width = width;
    this.height = height;

    // Listen for stream end
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.addEventListener("ended", this.handleStreamEnded);
    }
  }

  /**
   * Handler for stream ended event.
   */
  private handleStreamEnded = (): void => {
    this.streamEnded = true;
  };

  /**
   * Creates a MediaStreamProvider from a browser MediaStream.
   *
   * @param stream - MediaStream from getUserMedia() or other source
   * @param options - Optional configuration options
   * @returns Promise resolving to a MediaStreamProvider instance
   * @throws {MediaStreamInactiveError} If the stream is inactive
   * @throws {NoVideoTrackError} If the stream has no video track
   */
  static async create(
    stream: MediaStream,
    options?: MediaStreamProviderOptions,
  ): Promise<MediaStreamProvider> {
    // Validate stream is active
    if (!stream.active) {
      throw new MediaStreamInactiveError();
    }

    // Validate stream has video track
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      throw new NoVideoTrackError();
    }

    const videoTrack = videoTracks[0]!;
    const settings = videoTrack.getSettings();

    // Get dimensions and frame rate from track settings
    const width = settings.width ?? 640;
    const height = settings.height ?? 480;
    const fps = options?.fps ?? settings.frameRate ?? 30;

    // Create video element for stream playback
    const videoElement = document.createElement("video");
    videoElement.srcObject = stream;

    // Create canvas for frame extraction
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to get 2D rendering context");
    }

    // Start video playback
    await videoElement.play();

    return new MediaStreamProvider(
      stream,
      videoElement,
      context,
      fps,
      width,
      height,
    );
  }

  /**
   * Retrieves the next frame from the stream.
   *
   * @returns Promise resolving to the next VideoFrame, or null when stream ends
   */
  async getNextFrame(): Promise<VideoFrame | null> {
    // Check if disposed or stream ended
    if (this.disposed || this.streamEnded || !this.stream.active) {
      return null;
    }

    // Check if video track is still live
    const videoTrack = this.stream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState === "ended") {
      return null;
    }

    // Draw current video frame to canvas
    this.context.drawImage(this.videoElement, 0, 0);

    // Extract image data from canvas
    const imageData = this.context.getImageData(0, 0, this.width, this.height);

    // Calculate timestamp based on frame index and interval
    const timestamp = this.currentFrameIndex * this.frameInterval;

    const frame: VideoFrame = {
      data: imageData.data,
      width: this.width,
      height: this.height,
      timestamp,
      frameIndex: this.currentFrameIndex,
    };

    this.currentFrameIndex++;
    return frame;
  }

  /**
   * Returns the target frame rate in frames per second.
   *
   * @returns Frame rate as a positive number
   */
  getFps(): number {
    return this.fps;
  }

  /**
   * Returns metadata about the video stream.
   *
   * @returns FrameMetadata with width, height (no duration for live streams)
   */
  getMetadata(): FrameMetadata {
    return {
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Returns the frame interval in milliseconds.
   * Used for frame rate limiting calculations.
   *
   * @returns Frame interval in milliseconds
   */
  getFrameInterval(): number {
    return this.frameInterval;
  }

  /**
   * Disposes of the provider and releases resources.
   * After calling dispose(), getNextFrame() will return null.
   */
  dispose(): void {
    this.disposed = true;

    // Stop video playback
    this.videoElement.pause();
    this.videoElement.srcObject = null;

    // Remove event listeners
    const videoTrack = this.stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.removeEventListener("ended", this.handleStreamEnded);
    }
  }
}

/**
 * Factory function to create a MediaStreamProvider from a browser MediaStream.
 *
 * @param stream - MediaStream from getUserMedia() or other source
 * @param options - Optional configuration options
 * @returns Promise resolving to a MediaStreamProvider instance
 * @throws {MediaStreamInactiveError} If the stream is inactive
 * @throws {NoVideoTrackError} If the stream has no video track
 *
 * @example
 * ```typescript
 * const stream = await navigator.mediaDevices.getUserMedia({ video: true });
 * const provider = await createMediaStreamProvider(stream, { fps: 30 });
 *
 * let frame = await provider.getNextFrame();
 * while (frame !== null) {
 *   console.log(`Processing frame ${frame.frameIndex}`);
 *   frame = await provider.getNextFrame();
 * }
 *
 * provider.dispose();
 * ```
 */
export async function createMediaStreamProvider(
  stream: MediaStream,
  options?: MediaStreamProviderOptions,
): Promise<MediaStreamProvider> {
  return MediaStreamProvider.create(stream, options);
}
