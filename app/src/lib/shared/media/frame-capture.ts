/**
 * Frame capture service for live pose detection. Grabs frames from a video
 * element at a target FPS, downsamples them, and feeds them to a callback.
 *
 * This bridges the gap between the camera (MediaStream → <video>) and the
 * pose detection worker (which expects RGBA frame data via pushFrame).
 */

import { downsampleToImageData } from "./downsample";

export interface FrameData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  frameIndex: number;
  timestamp: number;
}

export interface FrameCaptureHandle {
  /** Stop the capture loop. */
  stop(): void;
  /** True while capture is running. */
  readonly running: boolean;
}

export interface FrameCaptureOptions {
  /** Target frames per second (default 15). */
  fps?: number;
  /** Max edge for downsampling (default 256). Smaller = faster pose detection. */
  maxEdge?: number;
  /**
   * Epoch (ms) subtracted from `performance.now()` to form frame timestamps.
   * Defaults to 0 — i.e. absolute `performance.now()` — so successive capture
   * instances (setup screen, then practice loop) share one monotonic clock.
   * A per-instance epoch would make the second stream's timestamps jump
   * backwards, confusing the timestamp-driven coordinator across the handoff.
   */
  startTime?: number;
}

/**
 * Starts a frame capture loop that grabs frames from a video element and
 * calls the provided callback with downsampled RGBA data.
 *
 * The loop uses setInterval rather than requestAnimationFrame because we
 * want a consistent frame rate even when the tab is backgrounded (important
 * for mobile where users might lock the screen briefly).
 *
 * @param video The video element to capture from (must have a playing stream).
 * @param onFrame Callback invoked with each captured frame.
 * @param options Capture configuration.
 */
export function startFrameCapture(
  video: HTMLVideoElement,
  onFrame: (frame: FrameData) => void,
  options: FrameCaptureOptions = {},
): FrameCaptureHandle {
  const fps = options.fps ?? 15;
  const maxEdge = options.maxEdge ?? 256;
  const startTime = options.startTime ?? 0;

  let frameIndex = 0;
  let running = true;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  // `downsampleToImageData` owns its own (reused) canvas internally, so
  // the capture loop just hands it the video element each tick.
  function captureFrame(): void {
    if (!running) return;

    // Wait for video to have valid dimensions.
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh || video.readyState < 2) {
      // Not ready yet; will try again next interval.
      return;
    }

    try {
      const imageData = downsampleToImageData(video, vw, vh, maxEdge);
      const timestamp = performance.now() - startTime;

      onFrame({
        data: imageData.data,
        width: imageData.width,
        height: imageData.height,
        frameIndex,
        timestamp,
      });

      frameIndex += 1;
    } catch (err) {
      // Canvas security errors can occur with cross-origin streams.
      // Log once and continue; the stream might become available later.
      console.warn("[frame-capture] Error capturing frame:", err);
    }
  }

  // Start the capture loop.
  const intervalMs = Math.round(1000 / fps);
  intervalId = setInterval(captureFrame, intervalMs);

  // Capture the first frame immediately.
  captureFrame();

  return {
    stop() {
      running = false;
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    get running() {
      return running;
    },
  };
}

/**
 * Creates a frame capture that feeds frames directly to a live session's
 * pushFrame method. This is the main integration point for live practice.
 */
export function createLiveFrameCapture(
  video: HTMLVideoElement,
  session: { pushFrame?(frame: FrameData): void },
  options?: FrameCaptureOptions,
): FrameCaptureHandle | null {
  if (!session.pushFrame) {
    // Replay sessions don't have pushFrame; they self-drive.
    return null;
  }

  const pushFrame = session.pushFrame.bind(session);
  return startFrameCapture(video, pushFrame, options);
}
