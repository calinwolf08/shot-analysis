/**
 * Per-shot clip recording from the live camera stream (on-device only).
 *
 * `segments` staggered MediaRecorders (default 3) run while the player is
 * positioned. Each restarts after `segmentMs`, offset by `segmentMs/segments`,
 * so at any moment one of them has been recording for at least
 * `segmentMs × (segments−1)/segments` (10 s with the defaults) — enough to
 * reach back past the rep's pre-roll, since a shot is only handed over once it
 * has ended and been analyzed (~9 s after it started). When a shot is
 * captured, the shortest segment that started before the shot (minus pre-roll)
 * is kept and the others are discarded, so a clip covers the shot but never
 * grows past `segmentMs`, however long the player stands there.
 *
 * Every segment records its start time on the `performance.now()` clock (the
 * same clock as live pose frames), so review can seek the video to any pose
 * frame exactly instead of guessing.
 *
 * Size is bounded by the bitrate (`videoBitsPerSecond`, default 0.9 Mbps):
 * ~0.1 MB per second of clip, ≤ ~1.7 MB for a full 15 s segment.
 *
 * Returns null when MediaRecorder isn't available (SSR, some webviews) so
 * callers never branch on platform — recording is simply skipped.
 */

export interface ClipTake {
  readonly blob: Blob;
  readonly mime: string;
  /** performance.now() when this clip's first frame was recorded. */
  readonly startTs: number;
}

export interface ShotClipRecorder {
  readonly recording: boolean;
  /** Begin rolling segments (idempotent while recording). */
  start(): void;
  /**
   * Stop and keep the clip that best covers `fromTs` onward (the shortest
   * segment that started at or before it; else the oldest). Null if nothing
   * was recorded.
   */
  takeCovering(fromTs: number): Promise<ClipTake | null>;
  /** Stop and drop everything (e.g. the player walked out of position). */
  discard(): void;
  /**
   * Pause segment rotation (true) while a shot is in progress and being
   * analyzed, so the segments that started before it aren't replaced before
   * its clip is taken — analysis on a slow phone can take longer than a
   * rotation. Rotation resumes on hold(false), or after MAX_HOLD_MS as a size
   * guard.
   */
  hold(on: boolean): void;
}

/** The slice of MediaRecorder used here (injectable for tests). */
export interface RecorderLike {
  readonly state: "inactive" | "recording" | "paused";
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start(timesliceMs?: number): void;
  stop(): void;
}

export interface ShotClipRecorderOptions {
  segmentMs?: number;
  /** Staggered recorders kept rolling (≥ 2). */
  segments?: number;
  videoBitsPerSecond?: number;
  now?: () => number;
  /** Rotation check interval (ms). */
  tickMs?: number;
  makeRecorder?: (
    stream: MediaStream,
    mime: string,
    bps: number,
  ) => RecorderLike;
}

// VP8 first: far cheaper to encode than VP9, which matters with three
// recorders running beside pose detection on a phone (a starved encoder emits
// only a handful of frames — a clip that looks like a still).
export const PREFERRED_MIME = [
  "video/webm;codecs=vp8",
  "video/webm;codecs=vp9",
  "video/webm",
  "video/mp4", // iOS Safari / WKWebView
];

export const DEFAULT_SEGMENT_MS = 15_000;
/** A hold never lasts longer than this (bounds clip size if stuck). */
export const MAX_HOLD_MS = 60_000;
export const DEFAULT_SEGMENTS = 3;
export const DEFAULT_VIDEO_BPS = 900_000;
/** MediaRecorder timeslice (ms). */
export const CHUNK_MS = 1000;

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    PREFERRED_MIME.find((m) => {
      try {
        return MediaRecorder.isTypeSupported(m);
      } catch {
        return false;
      }
    }) ?? ""
  );
}

function defaultMakeRecorder(
  stream: MediaStream,
  mime: string,
  bps: number,
): RecorderLike {
  // A keyframe every second where the browser supports asking for one
  // (Chromium); others ignore it. Few keyframes make seeking slow — review
  // decodes the clip into frames anyway (review/clip-frames.ts).
  const opts: MediaRecorderOptions & {
    videoKeyFrameIntervalDuration?: number;
  } = { videoBitsPerSecond: bps, videoKeyFrameIntervalDuration: 1000 };
  if (mime) opts.mimeType = mime;
  return new MediaRecorder(stream, opts) as unknown as RecorderLike;
}

interface Slot {
  rec: RecorderLike;
  chunks: Blob[];
  startTs: number;
}

export function createShotClipRecorder(
  stream: MediaStream,
  opts: ShotClipRecorderOptions = {},
): ShotClipRecorder | null {
  const custom = !!opts.makeRecorder;
  if (!custom && typeof MediaRecorder === "undefined") return null;
  if (!custom && stream.getVideoTracks().length === 0) return null;

  const segmentMs = opts.segmentMs ?? DEFAULT_SEGMENT_MS;
  const segments = Math.max(2, opts.segments ?? DEFAULT_SEGMENTS);
  const bps = opts.videoBitsPerSecond ?? DEFAULT_VIDEO_BPS;
  const now = opts.now ?? (() => performance.now());
  const make = opts.makeRecorder ?? defaultMakeRecorder;
  const mime = custom ? "video/webm" : pickMime();

  let slots: Slot[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  let active = false;

  function open(): Slot | null {
    try {
      const rec = make(stream, mime, bps);
      const slot: Slot = { rec, chunks: [], startTs: now() };
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) slot.chunks.push(e.data);
      };
      // A timeslice makes the encoder flush regularly instead of holding the
      // whole segment until stop() (some browsers only write a playable,
      // seekable stream that way).
      rec.start(CHUNK_MS);
      return slot;
    } catch {
      return null;
    }
  }

  function close(slot: Slot): void {
    slot.rec.ondataavailable = null;
    slot.rec.onstop = null;
    try {
      if (slot.rec.state !== "inactive") slot.rec.stop();
    } catch {
      /* ignore */
    }
  }

  /** When the current hold began (null = rotating normally). */
  let heldSince: number | null = null;

  /** Keep `segments` staggered segments rolling. */
  function tick(): void {
    if (!active) return;
    const t = now();
    if (heldSince !== null && t - heldSince >= MAX_HOLD_MS) heldSince = null;
    const held = heldSince !== null;
    // Held: never replace a segment (adding staggered ones is still fine).
    slots = slots.map((s) => {
      if (held || t - s.startTs < segmentMs) return s;
      close(s);
      return open() ?? s;
    });
    const newest = slots.reduce<Slot | null>(
      (a, b) => (!a || b.startTs > a.startTs ? b : a),
      null,
    );
    if (
      newest &&
      slots.length < segments &&
      t - newest.startTs >= segmentMs / segments
    ) {
      const next = open();
      if (next) slots.push(next);
    }
  }

  function stopAll(): void {
    active = false;
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    get recording() {
      return active;
    },

    start() {
      if (active) return;
      const first = open();
      if (!first) return;
      slots = [first];
      active = true;
      timer = setInterval(tick, opts.tickMs ?? 250);
    },

    async takeCovering(fromTs) {
      if (!active) return null;
      stopAll();
      const covering = slots.filter((s) => s.startTs <= fromTs);
      const keep =
        covering.length > 0
          ? covering.reduce((a, b) => (b.startTs > a.startTs ? b : a))
          : slots.reduce((a, b) => (b.startTs < a.startTs ? b : a));
      for (const s of slots) if (s !== keep) close(s);
      slots = [];
      const blob = await new Promise<Blob | null>((resolve) => {
        const finish = () =>
          resolve(
            keep.chunks.length > 0
              ? new Blob(keep.chunks, { type: mime || "video/webm" })
              : null,
          );
        if (keep.rec.state === "inactive") return finish();
        keep.rec.onstop = finish;
        try {
          keep.rec.stop();
        } catch {
          finish();
        }
      });
      return blob ? { blob, mime: blob.type, startTs: keep.startTs } : null;
    },

    hold(on) {
      if (on) heldSince ??= now();
      else heldSince = null;
    },

    discard() {
      stopAll();
      for (const s of slots) close(s);
      slots = [];
    },
  };
}
