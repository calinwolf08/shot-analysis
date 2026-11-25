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
 *
 * Android Firefox may never finish a seek on such a clip at all (`seeking`
 * fires, `seeked` doesn't) while plain playback works. So when the start
 * seek doesn't complete, the element is reloaded — that rewinds to 0 with no
 * seek — and played through from the beginning instead.
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
  /**
   * A grabbed frame may be this far (s) from its target time (default 0.25:
   * a sparse recording only has frames every ~0.2 s; a jump to the clip end
   * is seconds off).
   */
  readonly tolerance?: number;
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

/** Reload the source (back to time 0 without seeking); false on timeout. */
function rewindByReload(
  video: HTMLVideoElement,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      video.removeEventListener("loadeddata", onReady);
      resolve(ok);
    };
    const onReady = () => done(true);
    const timer = setTimeout(() => done(video.readyState >= 2), timeoutMs);
    video.addEventListener("loadeddata", onReady);
    try {
      video.load();
    } catch {
      done(false);
    }
  });
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
  const tol = o.tolerance ?? 0.25;
  let filled = 0;
  const missing = () =>
    order.map((_, k) => k).filter((k) => out[order[k]!.i] === null);
  /** Keep a frame only if the video is really at (about) its time. */
  const tryPut = (k: number, t: number) => {
    if (out[order[k]!.i] || Math.abs(t - order[k]!.t) > tol) return;
    const c = grab(video, maxSize);
    if (!c) return;
    out[order[k]!.i] = { canvas: c, time: t };
    filled++;
    o.onProgress?.(filled, order.length);
  };
  video.muted = true;

  /**
   * Play through once (one linear decode), grabbing each still-missing frame
   * as its time is passed. A frame whose time was skipped (the clip jumped,
   * or ended at once — seen on Android Firefox right after a seek) stays
   * missing for the next pass instead of getting the wrong picture.
   */
  const playThrough = async (
    from: "seek" | "reload",
    rate: number,
  ): Promise<boolean> => {
    const todo = missing();
    if (todo.length === 0) return true;
    const ok =
      from === "seek"
        ? await seekTo(
            video,
            Math.max(0, order[todo[0]!]!.t - 0.05),
            seekTimeoutMs,
          )
        : await rewindByReload(video, seekTimeoutMs);
    if (!ok || o.cancelled?.()) return ok;
    try {
      video.muted = true;
      video.playbackRate = rate;
      await video.play();
    } catch {
      return ok;
    }
    const rvfc = (
      video as HTMLVideoElement & {
        requestVideoFrameCallback?: (
          cb: (n: number, m: { mediaTime: number }) => void,
        ) => number;
      }
    ).requestVideoFrameCallback?.bind(video);
    await new Promise<void>((resolve) => {
      let next = 0;
      let lastProgress = performance.now();
      let lastTime = -1;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearInterval(watch);
        resolve();
      };
      const handle = (t: number) => {
        if (t !== lastTime) {
          lastTime = t;
          lastProgress = performance.now();
        }
        while (next < todo.length && order[todo[next]!]!.t <= t + 0.008) {
          tryPut(todo[next]!, t);
          next++;
        }
        if (next >= todo.length) finish();
      };
      const watch = setInterval(() => {
        if (
          o.cancelled?.() ||
          video.ended ||
          performance.now() - lastProgress > stallMs
        )
          finish();
      }, 100);
      if (rvfc) {
        const tick = (_n: number, m: { mediaTime: number }) => {
          if (finished) return;
          handle(m.mediaTime);
          if (!finished) rvfc(tick);
        };
        rvfc(tick);
      } else {
        const tick = () => {
          if (finished) return;
          handle(video.currentTime);
          if (!finished) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    });
    video.pause();
    video.playbackRate = 1;
    return true;
  };

  // 1) Seek near the first frame and play through.
  const seekOk = await playThrough("seek", o.playbackRate ?? 2);
  // 2) Anything missed (seek hung, clip jumped or ended early): reload —
  //    back to time 0 without seeking — and play through from the start, at
  //    normal speed this time (a busy phone can skip frames at 2x).
  if (missing().length > 0 && !o.cancelled?.()) await playThrough("reload", 1);
  // 3) Still missing and seeking works: seek to each remaining time.
  if (seekOk) {
    for (const k of missing()) {
      if (o.cancelled?.()) break;
      if (await seekTo(video, order[k]!.t, seekTimeoutMs))
        tryPut(k, video.currentTime);
    }
  }
  o.onProgress?.(order.length, order.length);
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
