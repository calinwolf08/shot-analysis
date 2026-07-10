/**
 * CaptureService — thin seam over getUserMedia so the setup/live screens
 * never touch navigator directly. The fake variant drives tests and the
 * replay e2e mode (no camera in headless Chromium without flags).
 */

export interface CaptureHandle {
  stream: MediaStream;
  stop(): void;
}

export class CameraPermissionError extends Error {
  constructor(cause?: unknown) {
    super("Camera permission denied or unavailable");
    this.name = "CameraPermissionError";
    this.cause = cause;
  }
}

export interface CaptureService {
  /** Opens the camera. Throws CameraPermissionError when blocked. */
  start(constraints?: MediaStreamConstraints): Promise<CaptureHandle>;
  /** True when a camera is plausibly available on this platform. */
  isAvailable(): boolean;
}

/** Real camera via getUserMedia (webview-compatible, works in Capacitor). */
export function createBrowserCaptureService(): CaptureService {
  return {
    isAvailable() {
      return (
        typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia
      );
    },

    async start(constraints = { video: { facingMode: "environment" } }) {
      if (!this.isAvailable()) throw new CameraPermissionError();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        throw new CameraPermissionError(err);
      }
      return {
        stream,
        stop() {
          for (const track of stream.getTracks()) track.stop();
        },
      };
    },
  };
}

export interface FakeCaptureService extends CaptureService {
  /** Calls received, for assertions. */
  readonly starts: MediaStreamConstraints[];
  readonly stopped: number;
}

/**
 * Test/replay capture: yields an inert MediaStream-shaped object (no
 * tracks needed by the setup screen, which only binds it to a <video>).
 */
export function createFakeCaptureService(
  opts: { available?: boolean; failWith?: Error } = {},
): FakeCaptureService {
  const starts: MediaStreamConstraints[] = [];
  let stopped = 0;
  return {
    starts,
    get stopped() {
      return stopped;
    },
    isAvailable: () => opts.available ?? true,
    async start(constraints = { video: true }) {
      if (opts.failWith) throw opts.failWith;
      starts.push(constraints);
      const stream = { getTracks: () => [] } as unknown as MediaStream;
      return {
        stream,
        stop() {
          stopped += 1;
        },
      };
    },
  };
}
