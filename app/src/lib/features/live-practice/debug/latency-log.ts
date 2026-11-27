/**
 * Per-shot latency log for the debug capture (`?debug=on`), kept for the
 * whole session (the capture itself keeps only the last ~20 s). Times are
 * performance.now() (wall clock — the pose clock stops while live detection
 * is paused), reported in ms from the shot's start (the rep trigger: the
 * wrist's fast rise, just before the release).
 *
 *   repEnd    — the rep ended (at the release, or once the wrist settled)
 *   refined   — the full-rate re-check finished
 *   scored    — the pipeline scored (and stored) the shot
 *   spoken    — the score started being spoken  ← what the player waits for
 *
 * Pure bookkeeping (no DOM); the practice page feeds it.
 */
import type { RefineReport } from "../refine/full-rate";

export interface ShotLatency {
  /** 1-based, every rep (also the ones that weren't a shot). */
  readonly rep: number;
  /** How the rep ended ("released" | "settled" | "max-duration"). */
  trigger?: string;
  /** "scored" | "no-shot" | "wrong-angle" | "error" | "pending". */
  outcome: string;
  /** ms from the shot's start. */
  repEndMs?: number;
  refinedMs?: number;
  scoredMs?: number;
  spokenMs?: number;
  /** The re-check: total, time to hand over its frames, frames, source… */
  refine?: Pick<
    RefineReport,
    | "ok"
    | "reason"
    | "ms"
    | "framesMs"
    | "frames"
    | "spanMs"
    | "source"
    | "earlyFrames"
    | "extended"
  >;
  readback?: string;
}

export interface LatencySummary {
  readonly reps: number;
  readonly scored: number;
  /** Shot start → score spoken, over scored shots (ms). */
  readonly shotToSpokenMs: Stats | null;
  readonly shotToRepEndMs: Stats | null;
  readonly refineMs: Stats | null;
  /** Frames already being re-detected when the rep ended (early start). */
  readonly earlyFrames: Stats | null;
}

export interface Stats {
  readonly median: number;
  readonly mean: number;
  readonly min: number;
  readonly max: number;
  readonly n: number;
}

export function stats(xs: readonly number[]): Stats | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  const median = s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  const r = (x: number) => Math.round(x);
  return {
    median: r(median),
    mean: r(s.reduce((a, b) => a + b, 0) / s.length),
    min: r(s[0]!),
    max: r(s.at(-1)!),
    n: s.length,
  };
}

export interface LatencyLog {
  repStarted(): void;
  repEnded(trigger: string): void;
  refined(r: RefineReport): void;
  scored(outcome: "scored" | "no-shot" | "wrong-angle" | "error"): void;
  spoken(text: string): void;
  readonly shots: readonly ShotLatency[];
  summary(): LatencySummary;
}

/** At most this many reps are kept (oldest dropped). */
const MAX_REPS = 200;

export function createLatencyLog(
  now: () => number = () => performance.now(),
): LatencyLog {
  const shots: (ShotLatency & { start: number })[] = [];
  const cur = () => shots.at(-1);
  const since = (s: { start: number }) => Math.round(now() - s.start);
  return {
    repStarted() {
      shots.push({ rep: shots.length + 1, start: now(), outcome: "pending" });
      if (shots.length > MAX_REPS) shots.shift();
    },
    repEnded(trigger) {
      const s = cur();
      if (!s || s.repEndMs !== undefined) return;
      s.trigger = trigger;
      s.repEndMs = since(s);
    },
    refined(r) {
      const s = cur();
      if (!s || s.refinedMs !== undefined) return;
      s.refinedMs = since(s);
      s.refine = {
        ok: r.ok,
        ms: Math.round(r.ms),
        frames: r.frames,
        ...(r.reason ? { reason: r.reason } : {}),
        ...(r.framesMs !== undefined ? { framesMs: r.framesMs } : {}),
        ...(r.spanMs !== undefined ? { spanMs: r.spanMs } : {}),
        ...(r.source ? { source: r.source } : {}),
        ...(r.earlyFrames !== undefined ? { earlyFrames: r.earlyFrames } : {}),
        ...(r.extended !== undefined ? { extended: r.extended } : {}),
      };
    },
    scored(outcome) {
      const s = cur();
      if (!s || s.scoredMs !== undefined) return;
      s.scoredMs = since(s);
      s.outcome = outcome;
    },
    spoken(text) {
      const s = cur();
      if (!s || s.spokenMs !== undefined) return;
      s.spokenMs = since(s);
      s.readback = text;
    },
    get shots() {
      return shots.map(({ start: _start, ...rest }) => rest);
    },
    summary() {
      const scored = shots.filter((s) => s.outcome === "scored");
      const pick = (f: (s: ShotLatency) => number | undefined) =>
        stats(scored.map(f).filter((x): x is number => typeof x === "number"));
      return {
        reps: shots.length,
        scored: scored.length,
        shotToSpokenMs: pick((s) => s.spokenMs),
        shotToRepEndMs: pick((s) => s.repEndMs),
        refineMs: pick((s) => s.refine?.ms),
        earlyFrames: pick((s) => s.refine?.earlyFrames),
      };
    },
  };
}
