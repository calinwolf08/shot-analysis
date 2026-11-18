/**
 * Live focus areas — coaching "lenses" the player toggles so the live lesson
 * only coaches what they're drilling. Focus steers the spoken feedback and
 * the surfaced issues (coaching only); the overall score is unchanged so
 * progress stays comparable run to run.
 *
 * v3: one area per shot phase (Load, Rise, Set point, Release), plus Rhythm
 * (every timing metric, in any phase). Ids saved before v3 (e.g. "elbow",
 * "follow-through") are mapped onto these by `normalizeAreas`.
 */

/** The parts of a metric an area matches on (a v3 metric result). */
export interface FocusMetric {
  readonly id: string;
  readonly phase: string;
  readonly kind: string;
}

export interface FocusArea {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly match: (m: FocusMetric) => boolean;
}

export const FOCUS_AREAS: readonly FocusArea[] = [
  {
    id: "load",
    label: "Load",
    hint: "Knee bend, ball dip, balance",
    match: (m) => m.phase === "load",
  },
  {
    id: "rise",
    label: "Rise",
    hint: "Legs and ball rising together",
    match: (m) => m.phase === "rise",
  },
  {
    id: "set-point",
    label: "Set point",
    hint: "Height, elbow and posture at the top",
    match: (m) => m.phase === "setPoint",
  },
  {
    id: "release",
    label: "Release",
    hint: "Elbow path, release height, wrist snap",
    match: (m) => m.phase === "release",
  },
  {
    id: "rhythm",
    label: "Rhythm & timing",
    hint: "The order and timing of the motion",
    match: (m) => m.kind === "timing",
  },
];

/** Pre-v3 area ids → their closest v3 area. */
export const LEGACY_AREA_IDS: Readonly<Record<string, string>> = {
  "base-balance": "load",
  "load-depth": "load",
  elbow: "set-point",
  head: "set-point",
  "follow-through": "release",
};

const AREA_BY_ID = new Map(FOCUS_AREAS.map((a) => [a.id, a]));

/**
 * Known area ids in canonical order: legacy ids mapped, unknown ids dropped,
 * duplicates merged.
 */
export function normalizeAreas(ids: readonly string[]): string[] {
  const set = new Set(ids.map((id) => LEGACY_AREA_IDS[id] ?? id));
  return FOCUS_AREAS.filter((a) => set.has(a.id)).map((a) => a.id);
}

/** True when the metric belongs to ANY of the selected areas. */
export function metricMatchesAreas(
  m: FocusMetric,
  areaIds: readonly string[],
): boolean {
  return areaIds.some((aid) => AREA_BY_ID.get(aid)?.match(m) ?? false);
}

/**
 * The worst off-target metrics within the selected focus areas, worst first
 * (input is worst-first). Null when nothing is selected, so callers fall back
 * to the global worst.
 */
export function selectFocusWorst<T extends FocusMetric>(
  worst: readonly T[],
  areaIds: readonly string[],
  max = 3,
): T[] | null {
  if (areaIds.length === 0) return null;
  return worst.filter((m) => metricMatchesAreas(m, areaIds)).slice(0, max);
}

/** Short label for the current selection, e.g. "Set point +1" or "Everything". */
export function focusSummary(areaIds: readonly string[]): string {
  const areas = FOCUS_AREAS.filter((a) => areaIds.includes(a.id));
  if (areas.length === 0) return "Everything";
  if (areas.length === 1) return areas[0]!.label;
  return `${areas[0]!.label} +${areas.length - 1}`;
}
