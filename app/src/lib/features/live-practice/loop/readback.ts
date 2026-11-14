/**
 * Terse voice readback for a scored shot (live redesign — step 5).
 *
 * Turns the worst deviation metrics into a short, interruptible phrase the
 * audio service speaks after each shot — no coaching instruction, just the
 * metric, which way it's off, and by how much: e.g.
 *   "Set point low by 2, Elbow flare high by 6".
 *
 * Pure. Magnitude is expressed in the metric's native unit; timing gaps (Δt,
 * a fraction of shot duration) are converted to whole frames when the shot's
 * duration is known, which reads far more naturally than a raw fraction.
 *
 * @see docs/live-redesign-plan.md §3.6
 */
import type { MetricDeviation } from "$lib/features/scoring";

export interface ReadbackOptions {
  /** Max metrics to read (default 5 — the "5 worst"). */
  readonly max?: number;
  /** Shot length in frames, used to render Δt timing gaps as frames. */
  readonly durationFrames?: number;
}

/** Rounds a magnitude for speech: whole numbers where sensible, else trimmed. */
function formatMagnitude(m: MetricDeviation, durationFrames?: number): string {
  if (m.unit === "Δt" && durationFrames && durationFrames > 0) {
    return String(Math.max(1, Math.round(m.magnitude * durationFrames)));
  }
  const mag = m.magnitude;
  if (mag >= 1) return String(Math.round(mag));
  if (mag >= 0.1) return mag.toFixed(1);
  return mag.toFixed(2);
}

/** One metric's phrase, e.g. "Elbow flare high by 6". */
export function phraseFor(m: MetricDeviation, durationFrames?: number): string {
  if (!m.direction) return m.label;
  return `${m.label} ${m.direction} by ${formatMagnitude(m, durationFrames)}`;
}

/**
 * Builds the full readback string for the worst metrics, or "" when there is
 * nothing off-target to call out (the caller may stay silent or play a cue).
 */
export function buildWorstReadback(
  worst: readonly MetricDeviation[],
  opts: ReadbackOptions = {},
): string {
  const max = opts.max ?? 5;
  return worst
    .slice(0, max)
    .map((m) => phraseFor(m, opts.durationFrames))
    .join(", ");
}
