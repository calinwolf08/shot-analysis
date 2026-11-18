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

/** Shot phases in the order they happen (feedback is reported in this order). */
export const PHASE_ORDER = [
  "gather",
  "load",
  "rise",
  "setPoint",
  "release",
  "followThrough",
] as const;

/** Spoken / shown phase names. */
export const PHASE_NAME: Record<string, string> = {
  gather: "Gather",
  load: "Load",
  rise: "Rise",
  setPoint: "Set point",
  release: "Release",
  followThrough: "Follow-through",
};

export const phaseName = (phase: string): string => PHASE_NAME[phase] ?? phase;

/** Stable sort into shot order (unknown phases last). */
export function inPhaseOrder<T extends { readonly phase: string }>(
  items: readonly T[],
): T[] {
  const rank = (p: string) => {
    const i = (PHASE_ORDER as readonly string[]).indexOf(p);
    return i < 0 ? PHASE_ORDER.length : i;
  };
  return items
    .map((m, i) => ({ m, i }))
    .sort((a, b) => rank(a.m.phase) - rank(b.m.phase) || a.i - b.i)
    .map((x) => x.m);
}

/** Default number of issues fed back per shot. */
export const FEEDBACK_COUNT = 3;

/**
 * The shot's feedback items: the `max` WORST metrics (input is worst-first),
 * then re-ordered by phase so they read in the order the shot happens.
 */
export function feedbackItems<T extends { readonly phase: string }>(
  worst: readonly T[],
  max: number = FEEDBACK_COUNT,
): T[] {
  return inPhaseOrder(worst.slice(0, max));
}

export interface ReadbackOptions {
  /** Max metrics to read (default 3 — the "3 worst"). */
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
 * Builds the readback for the worst metrics — the `max` worst, in phase order,
 * each group introduced by its phase: "Load: Knees end low by 0.4. Set point:
 * Elbow angle low by 91." — or "" when nothing is off-target.
 */
export function buildWorstReadback(
  worst: readonly MetricDeviation[],
  opts: ReadbackOptions = {},
): string {
  const items = feedbackItems(worst, opts.max ?? FEEDBACK_COUNT);
  const groups: { phase: string; phrases: string[] }[] = [];
  for (const m of items) {
    const phrase = phraseFor(m, opts.durationFrames);
    const last = groups.at(-1);
    if (last && last.phase === m.phase) last.phrases.push(phrase);
    else groups.push({ phase: m.phase, phrases: [phrase] });
  }
  return groups
    .map((g) => `${phaseName(g.phase)}: ${g.phrases.join(", ")}.`)
    .join(" ");
}
