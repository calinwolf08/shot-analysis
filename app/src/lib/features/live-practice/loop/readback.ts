/**
 * Voice readback for a scored shot.
 *
 * After each shot the player hears the 3 worst issues as COACHING CUES, in
 * the order the shot happens, each group introduced by its phase:
 *   "Load: Bend your knees more. Set point: Raise your set point."
 * The screen shows the same items as measurements (see the v3 scorecard).
 *
 * Pure.
 */
/** Shot phases in the order they happen (feedback is reported in this order). */
export const PHASE_ORDER = [
  "gather",
  "setup",
  "load",
  "rise",
  "setPoint",
  "release",
  "followThrough",
] as const;

/** Spoken / shown phase names. */
export const PHASE_NAME: Record<string, string> = {
  gather: "Gather",
  setup: "Setup",
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

/** What a readback item needs: its phase, cue and (fallback) label. */
export interface CueItem {
  readonly phase: string;
  readonly label: string;
  readonly cue: string | null;
}

/**
 * The spoken readback for feedback items (already chosen + ordered):
 * cues grouped by phase — or "" when there's nothing to say.
 */
export function buildCueReadback(items: readonly CueItem[]): string {
  const groups: { phase: string; cues: string[] }[] = [];
  for (const m of items) {
    const cue = m.cue ?? m.label;
    const last = groups.at(-1);
    if (last && last.phase === m.phase) last.cues.push(cue);
    else groups.push({ phase: m.phase, cues: [cue] });
  }
  return groups
    .map((g) => `${phaseName(g.phase)}: ${g.cues.join(". ")}.`)
    .join(" ");
}
