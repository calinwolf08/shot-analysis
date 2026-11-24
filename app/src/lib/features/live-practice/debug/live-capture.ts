/**
 * Live practice "flight recorder" (`?debug=capture`, production included):
 * keeps the last ~20 s of everything needed to work out why a shot was or
 * wasn't recognized, and exports it as one JSON file:
 *
 *  - `poses` — the raw pose frames in the replay-fixture format
 *    (PoseData: width / height / fps / frames with landmarks + timestamps),
 *    so the exact stream can be replayed through the same coordinator and
 *    pipeline on a dev machine;
 *  - `events` — what the loop decided, in order: coordinator state changes,
 *    rep start / analysis / result / "no shot" (+ reason), near-miss
 *    triggers, arming (positioning) changes, readiness (full body, detected
 *    orientation, agreement, cue), pipeline results (shots, rejections and
 *    why), errors;
 *  - `samples` — the coordinator's per-frame wrist velocity vs its trigger
 *    thresholds (thinned to ~10/s);
 *  - `meta` — device, camera size, fps, pose model, latency, tuning.
 *
 * Bounded memory: everything older than the window is dropped as it goes.
 */
import type { LandmarkFrame } from "$lib/features/analysis";

export const CAPTURE_WINDOW_MS = 20_000;
export const CAPTURE_VERSION = 1;

export interface CaptureEvent {
  /** Frame-clock ms (same clock as the pose frames' timestamps). */
  readonly t: number;
  readonly kind: string;
  readonly data?: unknown;
}

export interface CaptureSample {
  readonly t: number;
  readonly state: string;
  readonly posePresent: boolean;
  readonly velocity: number;
  readonly riseVelocity: number;
  readonly settleVelocity: number;
  readonly settledForMs: number | null;
}

export interface LiveCaptureFile {
  readonly version: typeof CAPTURE_VERSION;
  readonly capturedAt: string;
  readonly windowMs: number;
  readonly meta: Record<string, unknown>;
  /** Replay-fixture format (PoseData). */
  readonly poses: {
    readonly video: string;
    readonly fps: number;
    readonly totalFrames: number;
    readonly width: number;
    readonly height: number;
    readonly extractedAt: string;
    readonly frames: readonly unknown[];
  };
  readonly events: readonly CaptureEvent[];
  readonly samples: readonly CaptureSample[];
}

export interface LiveCapture {
  frame(f: LandmarkFrame): void;
  event(kind: string, data?: unknown): void;
  sample(s: CaptureSample): void;
  /** Static facts (device, tuning…) merged into the export's meta. */
  setMeta(patch: Record<string, unknown>): void;
  readonly frameCount: number;
  readonly spanMs: number;
  /** The last ~20 s as a JSON-serializable object. */
  export(extra?: {
    fps?: number;
    frameSize?: { width: number; height: number } | null;
  }): LiveCaptureFile;
}

/** 4 decimals is ~0.1 px on a 1080p frame: plenty, and half the size. */
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function createLiveCapture(windowMs = CAPTURE_WINDOW_MS): LiveCapture {
  let frames: LandmarkFrame[] = [];
  let events: CaptureEvent[] = [];
  let samples: CaptureSample[] = [];
  let lastSampleT = -Infinity;
  let meta: Record<string, unknown> = {};
  let now = 0;

  const trim = () => {
    const cutoff = now - windowMs;
    if (frames.length && frames[0]!.timestamp < cutoff)
      frames = frames.filter((f) => f.timestamp >= cutoff);
    if (events.length && events[0]!.t < cutoff)
      events = events.filter((e) => e.t >= cutoff);
    if (samples.length && samples[0]!.t < cutoff)
      samples = samples.filter((s) => s.t >= cutoff);
  };

  return {
    frame(f) {
      now = Math.max(now, f.timestamp);
      frames.push(f);
      // Trim in batches (cheap): at most ~1 s over the window.
      if (frames[0]!.timestamp < now - windowMs - 1000) trim();
    },
    event(kind, data) {
      events.push({ t: now, kind, ...(data !== undefined ? { data } : {}) });
    },
    sample(s) {
      if (s.t - lastSampleT < 100) return; // ~10/s
      lastSampleT = s.t;
      samples.push(s);
    },
    setMeta(patch) {
      meta = { ...meta, ...patch };
    },
    get frameCount() {
      return frames.length;
    },
    get spanMs() {
      return frames.length
        ? frames.at(-1)!.timestamp - frames[0]!.timestamp
        : 0;
    },
    export(extra = {}) {
      trim();
      const size = extra.frameSize ?? null;
      const out = frames.map((f) => ({
        frameIndex: f.frameIndex,
        timestamp: f.timestamp,
        ...(f.captureTs !== undefined ? { captureTs: r4(f.captureTs) } : {}),
        poseConfidence: r4(f.poseConfidence),
        landmarks: f.landmarks
          ? f.landmarks.map((l) => ({
              x: r4(l.x),
              y: r4(l.y),
              z: r4(l.z),
              visibility: r4(l.visibility),
            }))
          : null,
      }));
      const at = new Date().toISOString();
      return {
        version: CAPTURE_VERSION,
        capturedAt: at,
        windowMs,
        meta,
        poses: {
          video: "live-capture",
          fps: extra.fps ?? 30,
          totalFrames: out.length,
          width: size?.width ?? 0,
          height: size?.height ?? 0,
          extractedAt: at,
          frames: out,
        },
        events: [...events],
        samples: [...samples],
      };
    },
  };
}
