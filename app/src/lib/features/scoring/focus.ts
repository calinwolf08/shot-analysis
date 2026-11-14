/**
 * Live focus areas — a small curated set of coaching "lenses" the player can
 * toggle so the live lesson only coaches what they're drilling. Focus steers
 * the spoken readback and the surfaced issues (coaching only); the overall
 * deviation score is unchanged so progress stays comparable run to run.
 *
 * Areas are matched by metric id (there are ~88 raw metrics — far too many to
 * toggle individually), and overlap is fine: "Set point" and "Elbow alignment"
 * both surface a flared set-point elbow, which is the point.
 */
import type { MetricDeviation } from "./deviation";

export interface FocusArea {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  /** True when a metric id belongs to this area. */
  readonly match: (metricId: string) => boolean;
}

const has = (id: string, ...subs: string[]): boolean =>
  subs.some((s) => id.includes(s));

export const FOCUS_AREAS: readonly FocusArea[] = [
  {
    id: "base-balance",
    label: "Base & balance",
    hint: "Feet, hips & stance",
    match: (id) =>
      !id.startsWith("seq.") && has(id, "ankles", "hips", "knees", "shoulders"),
  },
  {
    id: "load-depth",
    label: "Load / dip depth",
    hint: "How deep you load",
    match: (id) =>
      has(id, "depth_drop", "hip_depth", "ball", "start_height") ||
      (id.startsWith("load.") && id.includes("knees")),
  },
  {
    id: "set-point",
    label: "Set point",
    hint: "Elbow, height & wrist set",
    // The set point itself, plus the wrist-prep path to it (not the snap).
    match: (id) =>
      id.startsWith("setPoint.") ||
      (id.includes("wrist") && !id.includes("wrist_snap")),
  },
  {
    id: "elbow",
    label: "Elbow alignment",
    hint: "Flare, angle & extension",
    match: (id) => id.includes("elbow"),
  },
  {
    id: "release",
    label: "Release",
    hint: "Release angle & timing",
    match: (id) => id.startsWith("release."),
  },
  {
    id: "follow-through",
    label: "Follow-through",
    hint: "Wrist snap & extension",
    match: (id) => id.startsWith("followThrough."),
  },
  {
    id: "head",
    label: "Head stillness",
    hint: "Keep your head steady",
    match: (id) => id.includes("head"),
  },
  {
    id: "rhythm",
    label: "Rhythm & timing",
    hint: "Sequence of the motion",
    match: (id) => id.startsWith("seq."),
  },
];

const AREA_BY_ID = new Map(FOCUS_AREAS.map((a) => [a.id, a]));

/** Keep only known area ids, in canonical order (drops stale/unknown ids). */
export function normalizeAreas(ids: readonly string[]): string[] {
  const set = new Set(ids);
  return FOCUS_AREAS.filter((a) => set.has(a.id)).map((a) => a.id);
}

/** True when the metric belongs to ANY of the selected areas. */
export function metricMatchesAreas(
  metricId: string,
  areaIds: readonly string[],
): boolean {
  return areaIds.some((aid) => AREA_BY_ID.get(aid)?.match(metricId) ?? false);
}

/**
 * The worst off-target metrics within the selected focus areas, worst first.
 * Returns null when nothing is selected, so callers fall back to global worst.
 */
export function selectFocusWorst(
  all: readonly MetricDeviation[],
  areaIds: readonly string[],
  max = 5,
): MetricDeviation[] | null {
  if (areaIds.length === 0) return null;
  return all
    .filter((m) => m.scored && !m.inBand && metricMatchesAreas(m.id, areaIds))
    .slice()
    .sort((a, b) => b.normDev - a.normDev)
    .slice(0, max);
}

/** Short label for the current selection, e.g. "Set point +1" or "Everything". */
export function focusSummary(areaIds: readonly string[]): string {
  const areas = FOCUS_AREAS.filter((a) => areaIds.includes(a.id));
  if (areas.length === 0) return "Everything";
  if (areas.length === 1) return areas[0]!.label;
  return `${areas[0]!.label} +${areas.length - 1}`;
}
