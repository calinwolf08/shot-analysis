/**
 * Decodes every frame of a recorded clip between two times, for re-running
 * pose detection on a shot at the camera's full frame rate (live tracking
 * only keeps up with ~10 fps on some phones).
 *
 * The clip is played (muted, hidden) and each PRESENTED frame is grabbed —
 * with `requestVideoFrameCallback` where available, which reports each
 * frame's exact media time; otherwise by polling `currentTime` every
 * animation frame.
 *
 * The start is reached by SEEKING when that works (Chrome: no wait at all),
 * else by playing from 0 at a high rate (fast-forward). Seeking a phone
 * recording is unreliable on some browsers (Android Firefox hangs a seek, or
 * ends a clip it seeked into the moment it plays), so a seek is checked — it
 * must land, and frames must follow — and on any failure, before a single
 * frame was handed out, the clip is decoded again from a fresh video element
 * by fast-forwarding.
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
  /** Fast-forward rate when the start has to be reached by playing (8). */
  readonly fastForwardRate?: number;
  /** Try seeking to the start first (default true); fast-forward on failure. */
  readonly seek?: boolean;
  /** A seek must land within this long (ms, default 1000). */
  readonly seekTimeoutMs?: number;
  readonly cancelled?: () => boolean;
}

export interface DecodeClipStats {
  readonly frames: number;
  /** How the start was reached: already there, seeked, or fast-forwarded. */
  readonly start: "at-start" | "seek" | "reload";
  /** A seek was tried and failed (then fast-forwarded). */
  readonly seekFailed?: boolean;
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

/** Seconds before the start a seek lands (keyframes are coarse on some files). */
const SEEK_LEAD_S = 0.3;
/** Fast-forward drops back to 1× this far (s) before the start. */
const FF_LEAD_S = 0.5;
/** After a seek, the first frame must arrive within this long (ms). */
const SEEK_FIRST_FRAME_MS = 1000;
/**
 * Seeking failed once in this page: this browser can't seek recordings, so
 * later decodes fast-forward straight away (only the first shot pays for
 * finding out).
 */
let seekBroken = false;

/** Tests: forget a failed seek. */
export function resetSeekSupport(): void {
  seekBroken = false;
}

export async function decodeClipRange(
  blob: Blob,
  fromS: number,
  toS: number,
  onFrame: (f: DecodedClipFrame) => void,
  o: DecodeClipOptions = {},
): Promise<DecodeClipStats> {
  const trySeek = (o.seek ?? true) && !seekBroken && fromS > FF_LEAD_S;
  if (!trySeek)
    return (await decodeOnce(
      blob,
      fromS,
      toS,
      onFrame,
      o,
      false,
    )) as DecodeClipStats;
  const first = await decodeOnce(blob, fromS, toS, onFrame, o, true);
  if (first !== "seek-failed") return first;
  seekBroken = true;
  if (o.cancelled?.()) {
    return {
      frames: 0,
      start: "seek",
      seekFailed: true,
      method: "rvfc",
      stopped: "cancelled",
      firstTime: null,
      lastTime: null,
    };
  }
  const again = await decodeOnce(blob, fromS, toS, onFrame, o, false);
  return { ...(again as DecodeClipStats), seekFailed: true };
}

/**
 * One decode on a fresh video element. With `seek`, "seek-failed" when the
 * seek didn't land or no frame followed it (nothing was handed out then).
 */
async function decodeOnce(
  blob: Blob,
  fromS: number,
  toS: number,
  onFrame: (f: DecodedClipFrame) => void,
  o: DecodeClipOptions,
  seek: boolean,
): Promise<DecodeClipStats | "seek-failed"> {
  const maxEdge = o.maxEdge ?? 256;
  const stallMs = o.stallMs ?? 2500;
  const ffRate = o.fastForwardRate ?? 8;
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
    if (o.cancelled?.()) return stats("cancelled");

    let fastForward = false;
    if (seek) {
      // Jump to just before the start; it must actually land there.
      start = "seek";
      const target = Math.max(0, fromS - SEEK_LEAD_S);
      const seeked = once(video, "seeked", o.seekTimeoutMs ?? 1000);
      video.currentTime = target;
      if (!(await seeked) || Math.abs(video.currentTime - target) > 0.5)
        return "seek-failed";
    } else if (fromS > 0.25) {
      // Reach the start by PLAYING from 0 (fast-forward), never by seeking.
      start = "reload";
      fastForward = true;
    }
    video.playbackRate = fastForward ? ffRate : 1;

    const result = await new Promise<
      DecodeClipStats["stopped"] | "seek-failed"
    >((resolve) => {
      let lastProgress = performance.now();
      const began = lastProgress;
      let lastSeen = -1;
      let finished = false;
      const finish = (why: DecodeClipStats["stopped"] | "seek-failed") => {
        if (finished) return;
        finished = true;
        clearInterval(watchdog);
        resolve(why);
      };
      // A seek that "landed" but plays nothing (or ends at once) failed.
      const seekDud = () => seek && frames === 0 && lastSeen < 0;
      const handle = (t: number) => {
        if (t === lastSeen) return;
        lastSeen = t;
        lastProgress = performance.now();
        if (fastForward && t >= fromS - FF_LEAD_S) {
          fastForward = false;
          video.playbackRate = 1;
        }
        if (t < fromS - 0.02 || fastForward) return;
        if (t > toS + 0.02)
          return finish(frames === 0 && seek ? "seek-failed" : "end");
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
        else if (video.ended)
          finish(seekDud() || (seek && frames === 0) ? "seek-failed" : "ended");
        else if (seekDud() && performance.now() - began > SEEK_FIRST_FRAME_MS)
          finish("seek-failed");
        else if (performance.now() - lastProgress > stallMs) finish("stall");
      }, 100);
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
      video
        .play()
        .catch(() => finish(seek && frames === 0 ? "seek-failed" : "stall"));
    });
    return result === "seek-failed" ? "seek-failed" : stats(result);
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}
