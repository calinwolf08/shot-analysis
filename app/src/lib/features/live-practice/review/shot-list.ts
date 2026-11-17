/**
 * Shots-tab list presentation: rows grouped under day headers ("Today",
 * "Yesterday", "Nov 14"), each labeled by time + its worst issue — e.g.
 * "4:12 PM · Set point low". (The orientation used to be the label; every
 * stored shot is now the same side-on view, so it no longer tells shots apart.)
 *
 * Pure; dates use the device's local time zone.
 */
import type { ShotScorecard } from "$lib/features/scoring";

export interface DayGroup<T> {
  /** Local calendar day, "YYYY-MM-DD". */
  readonly key: string;
  readonly label: string;
  readonly rows: T[];
}

function dayKey(t: number): string {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "Today", "Yesterday", "Nov 14", or "Nov 14, 2025" for another year. */
export function dayLabel(t: number, now: number): string {
  const key = dayKey(t);
  if (key === dayKey(now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dayKey(yesterday.getTime())) return "Yesterday";
  const d = new Date(t);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "4:12 PM" (locale-formatted clock time). */
export function timeLabel(t: number): string {
  return new Date(t).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The shot's headline issue: its worst off-target metric with direction
 * ("Set point low"), "On target" when nothing is off, or null when the shot
 * couldn't be scored (too little measured).
 */
export function shotIssue(card: ShotScorecard): string | null {
  if (card.overall === null) return null;
  const w = card.worst[0];
  if (!w) return "On target";
  return w.direction ? `${w.label} ${w.direction}` : w.label;
}

/** Groups rows (already newest-first) under day headers, preserving order. */
export function groupByDay<T extends { createdAt: number }>(
  rows: readonly T[],
  now: number,
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const row of rows) {
    const key = dayKey(row.createdAt);
    let g = groups.at(-1);
    if (!g || g.key !== key) {
      g = { key, label: dayLabel(row.createdAt, now), rows: [] };
      groups.push(g);
    }
    g.rows.push(row);
  }
  return groups;
}
