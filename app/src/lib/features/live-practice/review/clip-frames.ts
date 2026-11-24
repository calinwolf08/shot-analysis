/**
 * Decodes a shot clip ONCE into still frames at the pose frames' times, so
 * review can scrub and play by drawing those frames instead of seeking the
 * <video>.
 *
 * Why: phone recordings (MediaRecorder) can have very few keyframes — an
 * Android Firefox clip had 2 in 9.5 s. Showing any moment then means decoding
 * forward from the previous keyframe (100–200 frames on a phone), so every
 * scrub step cancels the last seek before it finishes and the picture looks
 * frozen. Playing the clip through once is a single linear decode; after that
 * every frame is instant and frame-exact, whatever the browser.
 *
 * Strategy: play muted from just before the first time, grabbing the shown
 * frame as each target time is passed; if playback won't start or stalls,
 * fall back to seeking to each remaining time in order.
 */

export interface ClipFrame {
  readonly canvas: HTMLCanvasElement;
  /** Video time (s) the frame was grabbed at. */
  readonly time: number;
}

export interface ExtractOptions {
  /** Longest side of the stored frames (px). */
  readonly maxSize?: number;
  readonly onProgress?: (done: number, total: number) => void;
  /** Return true to stop (e.g. the screen closed). */
  readonly cancelled?: () => boolean;
  /** No progress for this long during play-through → seek instead (ms). */
  readonly stallMs?: number;
  /** Per-seek timeout in the fallback (ms). */
  readonly seekTimeoutMs?: number;
  /** Play-through speed (higher = sooner, but frames may be skipped). */
  readonly playbackRate?: number;
}

/** Frames keyed by target index (same order as `times`). */
export type ClipFrames = (ClipFrame | null)[];

function grab(
  video: HTMLVideoElement,
  maxSize: number,
): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const k = Math.min(1, maxSize / Math.max(vw, vh));
  const c = document.createElement("canvas");
  c.width = Math.round(vw * k);
  c.height = Math.round(vh * k);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return c;
}

function seekTo(
  video: HTMLVideoElement,
  t: number,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      resolve(ok);
    };
    const onSeeked = () => done(true);
    const timer = setTimeout(() => done(false), timeoutMs);
    video.addEventListener("seeked", onSeeked);
    try {
      video.currentTime = t;
    } catch {
      done(false);
    }
  });
}

/**
 * Frames at `times` (seconds, any order). Entries stay null where a frame
 * couldn't be grabbed. Leaves the video paused.
 */
export async function extractClipFrames(
  video: HTMLVideoElement,
  times: readonly number[],
  o: ExtractOptions = {},
): Promise<ClipFrames> {
  const maxSize = o.maxSize ?? 480;
  const stallMs = o.stallMs ?? 1500;
  const seekTimeoutMs = o.seekTimeoutMs ?? 4000;
  const out: ClipFrames = times.map(() => null);
  const order = times.map((t, i) => ({ t, i })).sort((a, b) => a.t - b.t);
  if (order.length === 0) return out;
  let done = 0;
  const put = (k: number) => {
    const c = grab(video, maxSize);
    if (c) out[order[k]!.i] = { canvas: c, time: video.currentTime };
    done++;
    o.onProgress?.(done, order.length);
  };

  // 1) Play through once (one linear decode).
  let next = 0;
  video.muted = true;
  const startOk = await seekTo(
    video,
    Math.max(0, order[0]!.t - 0.05),
    seekTimeoutMs,
  );
  let played = false;
  if (startOk && !o.cancelled?.()) {
    try {
      video.playbackRate = o.playbackRate ?? 2;
      await video.play();
      played = true;
    } catch {
      played = false;
    }
  }
  if (played) {
    await new Promise<void>((resolve) => {
      let lastProgress = performance.now();
      let lastTime = video.currentTime;
      const tick = () => {
        if (o.cancelled?.()) return resolve();
        const ct = video.currentTime;
        if (ct !== lastTime) {
          lastTime = ct;
          lastProgress = performance.now();
        }
        while (next < order.length && order[next]!.t <= ct + 0.008) {
          put(next);
          next++;
        }
        if (next >= order.length || video.ended) return resolve();
        if (performance.now() - lastProgress > stallMs) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    video.pause();
    video.playbackRate = 1;
  }

  // 2) Whatever is left (playback refused or stalled, or the clip ended
  //    early): seek to each remaining time in order.
  for (; next < order.length; next++) {
    if (o.cancelled?.()) break;
    if (await seekTo(video, order[next]!.t, seekTimeoutMs)) put(next);
    else {
      done++;
      o.onProgress?.(done, order.length);
    }
  }
  return out;
}

/** Index of the nearest available frame at or before `i` (else after). */
export function nearestFrame(frames: ClipFrames, i: number): ClipFrame | null {
  for (let k = Math.min(i, frames.length - 1); k >= 0; k--) {
    const f = frames[k];
    if (f) return f;
  }
  for (let k = i + 1; k < frames.length; k++) {
    const f = frames[k];
    if (f) return f;
  }
  return null;
}
