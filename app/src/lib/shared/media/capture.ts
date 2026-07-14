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

/**
 * File-backed capture: plays a video file through a hidden <video> and
 * exposes it as a MediaStream via captureStream(), so the whole live path
 * (frame-capture → worker → coordinator) runs against a recorded clip with
 * no webcam. Dev/e2e only — lets you validate live shot detection from the
 * test videos in a browser without a camera. Requires a browser that can
 * decode the file's codec (e.g. H.264 mp4 needs a Chrome with H.264).
 */
export function createFileCaptureService(
  url: string,
  opts: { loop?: boolean; fps?: number } = {},
): CaptureService {
  return {
    isAvailable() {
      return (
        typeof document !== "undefined" &&
        typeof (
          HTMLVideoElement.prototype as unknown as {
            captureStream?: unknown;
          }
        ).captureStream === "function"
      );
    },

    async start() {
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.loop = opts.loop ?? true;
      video.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        video.addEventListener("loadeddata", () => resolve(), { once: true });
        video.addEventListener(
          "error",
          () =>
            reject(
              new CameraPermissionError(
                new Error(
                  `Cannot decode ${url} (code ${video.error?.code ?? "?"}). ` +
                    "This browser may lack the video codec (e.g. H.264).",
                ),
              ),
            ),
          { once: true },
        );
      });
      await video.play();

      const stream = (
        video as unknown as { captureStream(fps?: number): MediaStream }
      ).captureStream(opts.fps);

      return {
        stream,
        stop() {
          video.pause();
          for (const track of stream.getTracks()) track.stop();
          video.removeAttribute("src");
          video.load();
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
