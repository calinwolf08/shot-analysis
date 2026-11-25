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
  /**
   * The most recent rep windows re-detected at full frame rate (what the
   * shots were actually analyzed from), newest last.
   */
  readonly refined?: readonly {
    readonly startedAt: number;
    readonly frames: readonly unknown[];
  }[];
}

/** Pose timing while the player was tracked (from the recorded frames). */
export interface CaptureTiming {
  /** Frames with a pose, per second of time they span. */
  readonly posedFps: number | null;
  /** Capture → landmarks latency over frames WITH a pose (ms). */
  readonly latencyP50Ms: number | null;
  readonly latencyP90Ms: number | null;
  /** Same over frames without a pose (detection is cheaper then). */
  readonly emptyLatencyP50Ms: number | null;
  /** Gaps between consecutive frames (ms). */
  readonly gapP50Ms: number | null;
  readonly gapP90Ms: number | null;
}

export interface LiveCapture {
  /** `latencyMs`: capture → landmarks time for this frame, when known. */
  frame(f: LandmarkFrame, latencyMs?: number): void;
  event(kind: string, data?: unknown): void;
  sample(s: CaptureSample): void;
  /** A rep window re-detected at full frame rate (keeps the last 3). */
  refined(startedAt: number, frames: readonly LandmarkFrame[]): void;
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
  let frames: (LandmarkFrame & { lat?: number })[] = [];
  let events: CaptureEvent[] = [];
  let samples: CaptureSample[] = [];
  let lastSampleT = -Infinity;
  let meta: Record<string, unknown> = {};
  let refinedWindows: { startedAt: number; frames: LandmarkFrame[] }[] = [];
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
    frame(f, latencyMs) {
      now = Math.max(now, f.timestamp);
      frames.push(
        latencyMs !== undefined ? { ...f, lat: Math.round(latencyMs) } : f,
      );
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
    refined(startedAt, fr) {
      refinedWindows = [
        ...refinedWindows.filter((w) => w.startedAt !== startedAt),
        { startedAt, frames: [...fr] },
      ].slice(-3);
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
      const slim = (f: LandmarkFrame & { lat?: number }) => ({
        frameIndex: f.frameIndex,
        timestamp: f.timestamp,
        ...(f.captureTs !== undefined ? { captureTs: r4(f.captureTs) } : {}),
        poseConfidence: r4(f.poseConfidence),
        ...(f.lat !== undefined ? { lat: f.lat } : {}),
        landmarks: f.landmarks
          ? f.landmarks.map((l) => ({
              x: r4(l.x),
              y: r4(l.y),
              z: r4(l.z),
              visibility: r4(l.visibility),
            }))
          : null,
      });
      const out = frames.map(slim);
      const at = new Date().toISOString();
      return {
        version: CAPTURE_VERSION,
        capturedAt: at,
        windowMs,
        meta: { ...meta, timing: captureTiming(frames) },
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
        ...(refinedWindows.length
          ? {
              refined: refinedWindows.map((w) => ({
                startedAt: w.startedAt,
                frames: w.frames.map(slim),
              })),
            }
          : {}),
      };
    },
  };
}

function pct(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))]!;
}

export function captureTiming(
  frames: readonly (LandmarkFrame & { lat?: number })[],
): CaptureTiming {
  const posed = frames.filter((f) => f.landmarks);
  const span =
    posed.length > 1
      ? (posed.at(-1)!.timestamp - posed[0]!.timestamp) / 1000
      : 0;
  const gaps: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    // Only consecutive tracked frames (dropouts are not frame gaps).
    if (frames[i]!.landmarks && frames[i - 1]!.landmarks)
      gaps.push(frames[i]!.timestamp - frames[i - 1]!.timestamp);
  }
  const lat = posed.flatMap((f) => (f.lat !== undefined ? [f.lat] : []));
  const emptyLat = frames
    .filter((f) => !f.landmarks)
    .flatMap((f) => (f.lat !== undefined ? [f.lat] : []));
  return {
    posedFps: span > 0 ? (posed.length - 1) / span : null,
    latencyP50Ms: pct(lat, 0.5),
    latencyP90Ms: pct(lat, 0.9),
    emptyLatencyP50Ms: pct(emptyLat, 0.5),
    gapP50Ms: pct(gaps, 0.5),
    gapP90Ms: pct(gaps, 0.9),
  };
}
