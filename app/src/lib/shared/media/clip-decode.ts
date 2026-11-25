/**
 * Decodes every frame of a recorded clip between two times, for re-running
 * pose detection on a shot at the camera's full frame rate (live tracking
 * only keeps up with ~10 fps on some phones).
 *
 * The clip is played (muted, hidden) and each PRESENTED frame is grabbed —
 * with `requestVideoFrameCallback` where available, which reports each
 * frame's exact media time; otherwise by polling `currentTime` every
 * animation frame. Playing is one linear decode, and it works where seeking a
 * phone recording doesn't (Android Firefox hangs seeks, or ends a clip it
 * seeked into the moment it plays): the start time is reached by playing
 * from 0 at a higher rate, never by seeking.
 */
import { downsampleToImageData } from "./downsample";

export interface DecodedClipFrame {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  /** Time in the clip (s). */
  readonly mediaTime: number;
}

export interface DecodeClipOptions {
  /** Longest side of the frames handed out (default 256, like live). */
  readonly maxEdge?: number;
  /** No new frame for this long → stop (ms, default 2500). */
  readonly stallMs?: number;
  /** Fast-forward rate when the start has to be reached by playing. */
  readonly fastForwardRate?: number;
  readonly cancelled?: () => boolean;
}

export interface DecodeClipStats {
  readonly frames: number;
  /** How the start was reached: already there, or played/fast-forwarded to. */
  readonly start: "at-start" | "seek" | "reload";
  readonly method: "rvfc" | "raf";
  readonly stopped: "end" | "ended" | "stall" | "cancelled" | "no-video";
  /** First and last grabbed media time (s). */
  readonly firstTime: number | null;
  readonly lastTime: number | null;
}

type RvfcVideo = HTMLVideoElement & {
  requestVideoFrameCallback?(
    cb: (now: number, meta: { mediaTime: number }) => void,
  ): number;
  cancelVideoFrameCallback?(id: number): void;
};

function once(
  el: HTMLMediaElement,
  event: string,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      el.removeEventListener(event, onEvent);
      resolve(ok);
    };
    const onEvent = () => done(true);
    const timer = setTimeout(() => done(false), timeoutMs);
    el.addEventListener(event, onEvent);
  });
}

export async function decodeClipRange(
  blob: Blob,
  fromS: number,
  toS: number,
  onFrame: (f: DecodedClipFrame) => void,
  o: DecodeClipOptions = {},
): Promise<DecodeClipStats> {
  const maxEdge = o.maxEdge ?? 256;
  const stallMs = o.stallMs ?? 2500;
  const ffRate = o.fastForwardRate ?? 4;
  const video = document.createElement("video") as RvfcVideo;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  // In the document (some mobile browsers won't decode a detached video),
  // but invisible.
  video.style.cssText =
    "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
  document.body.append(video);
  const url = URL.createObjectURL(blob);
  let frames = 0;
  let firstTime: number | null = null;
  let lastTime: number | null = null;
  let start: DecodeClipStats["start"] = "at-start";
  const method: DecodeClipStats["method"] =
    typeof video.requestVideoFrameCallback === "function" ? "rvfc" : "raf";
  const stats = (stopped: DecodeClipStats["stopped"]): DecodeClipStats => ({
    frames,
    start,
    method,
    stopped,
    firstTime,
    lastTime,
  });
  try {
    const loaded = once(video, "loadeddata", 5000);
    video.src = url;
    if (!(await loaded) || !video.videoWidth) return stats("no-video");

    // Reach the start by PLAYING from 0 (fast-forward), never by seeking:
    // Android Firefox can hang a seek, or "end" a clip it seeked into as soon
    // as it's played.
    const fastForward0 = fromS > 0.25;
    let fastForward = fastForward0;
    if (fastForward0) start = "reload";
    if (o.cancelled?.()) return stats("cancelled");
    video.playbackRate = fastForward ? ffRate : 1;

    const result = await new Promise<DecodeClipStats["stopped"]>((resolve) => {
      let lastProgress = performance.now();
      let lastSeen = -1;
      let finished = false;
      const finish = (why: DecodeClipStats["stopped"]) => {
        if (finished) return;
        finished = true;
        clearInterval(watchdog);
        resolve(why);
      };
      const handle = (t: number) => {
        if (t === lastSeen) return;
        lastSeen = t;
        lastProgress = performance.now();
        if (fastForward && t >= fromS - 0.25) {
          fastForward = false;
          video.playbackRate = 1;
        }
        if (t < fromS - 0.02 || fastForward) return;
        if (t > toS + 0.02) return finish("end");
        const img = downsampleToImageData(
          video,
          video.videoWidth,
          video.videoHeight,
          maxEdge,
        );
        frames++;
        firstTime ??= t;
        lastTime = t;
        onFrame({
          data: img.data,
          width: img.width,
          height: img.height,
          mediaTime: t,
        });
      };
      const watchdog = setInterval(() => {
        if (o.cancelled?.()) finish("cancelled");
        else if (video.ended) finish("ended");
        else if (performance.now() - lastProgress > stallMs) finish("stall");
      }, 200);
      if (method === "rvfc") {
        const tick = (_now: number, meta: { mediaTime: number }) => {
          if (finished) return;
          handle(meta.mediaTime);
          if (!finished) video.requestVideoFrameCallback!(tick);
        };
        video.requestVideoFrameCallback!(tick);
      } else {
        const tick = () => {
          if (finished) return;
          handle(video.currentTime);
          if (!finished) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
      video.play().catch(() => finish("stall"));
    });
    return stats(result);
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}
