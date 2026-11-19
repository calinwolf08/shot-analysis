/**
 * End-to-end live pose latency: capture (main thread) → landmarks back from the
 * worker. Tracks a rolling window and decides when to fall back from the full
 * pose model to the lite one.
 *
 * Pure; the live session feeds it per-frame latencies.
 */

export type PoseModel = "full" | "lite";
export type ModelPolicy = "auto" | PoseModel;

export interface LatencyTracker {
  add(ms: number): void;
  /** Median of the window, or null when empty. */
  p50(): number | null;
  /** Samples currently in the window. */
  readonly size: number;
  /** Total samples seen (including ones that left the window). */
  readonly total: number;
  reset(): void;
}

export function createLatencyTracker(windowSize: number): LatencyTracker {
  let window: number[] = [];
  let total = 0;
  return {
    add(ms) {
      if (!Number.isFinite(ms) || ms < 0) return;
      window.push(ms);
      if (window.length > windowSize) window.shift();
      total += 1;
    },
    p50() {
      if (window.length === 0) return null;
      const sorted = [...window].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2
        ? sorted[mid]!
        : (sorted[mid - 1]! + sorted[mid]!) / 2;
    },
    get size() {
      return window.length;
    },
    get total() {
      return total;
    },
    reset() {
      window = [];
      total = 0;
    },
  };
}

export interface FallbackOptions {
  readonly policy: ModelPolicy;
  /** Switch to lite when the windowed p50 exceeds this (ms). */
  readonly liteFallbackP50Ms: number;
  /** Ignore this many first samples (WASM warm-up / first-inference cost). */
  readonly warmupFrames: number;
  /** The window must be full before deciding. */
  readonly windowFrames: number;
}

/**
 * Pure: should the session switch to the lite model now? Only under the
 * "auto" policy, only while on the full model, only once the warm-up has
 * passed and a full window has been measured after it.
 */
export function shouldFallBackToLite(
  current: PoseModel,
  tracker: Pick<LatencyTracker, "p50" | "size" | "total">,
  opts: FallbackOptions,
): boolean {
  if (opts.policy !== "auto" || current !== "full") return false;
  if (tracker.total < opts.warmupFrames + opts.windowFrames) return false;
  if (tracker.size < opts.windowFrames) return false;
  const p50 = tracker.p50();
  return p50 !== null && p50 > opts.liteFallbackP50Ms;
}
