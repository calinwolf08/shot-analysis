/**
 * Insights aggregation (live redesign — step 8).
 *
 * Pure read-model over a set of scored shots: for a time window it ranks the
 * recurring issues (metrics that land off-target most often and most severely)
 * and builds the overall-score trend, on the v3 0–10+ scale (0 = on target).
 * No session concept — shots are grouped purely by their timestamp, and
 * scores are recomputed from stored metrics by the caller (shots that can't be
 * re-analyzed are left out), never stored.
 *
 * @see docs/live-redesign-plan.md §3.10
 */
import type { ScorecardV3 } from "$lib/features/scoring/v3";

export type InsightsWindow = "today" | "7d" | "30d" | "all";

export interface WindowDef {
  readonly key: InsightsWindow;
  readonly label: string;
}

export const INSIGHTS_WINDOWS: readonly WindowDef[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

const DAY_MS = 86_400_000;

/** Inclusive epoch-ms lower bound for a window (0 for all-time). */
export function windowStart(key: InsightsWindow, now: number): number {
  switch (key) {
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case "7d":
      return now - 7 * DAY_MS;
    case "30d":
      return now - 30 * DAY_MS;
    case "all":
      return 0;
  }
}

export interface ScoredShotAt {
  readonly createdAt: number;
  readonly scorecard: ScorecardV3;
}

export interface RecurringIssue {
  readonly id: string;
  readonly label: string;
  /** v3 phase id ("load" | "rise" | "setPoint" | "release"). */
  readonly phase: string;
  readonly kind: string;
  /** How it's usually off ("too shallow"), the most frequent direction. */
  readonly phrase: string | null;
  /** Shots (in the window) where this metric was off-target. */
  readonly occurrences: number;
  /** occurrences / shotCount (0..1). */
  readonly frequency: number;
  /** Mean 0–10+ score across the off-target shots. */
  readonly avgScore: number;
  /** Ranking weight = occurrences × avgScore (frequency × severity). */
  readonly rank: number;
}

export interface TrendPoint {
  readonly t: number;
  readonly overall: number | null;
}

export interface InsightsSummary {
  readonly window: InsightsWindow;
  readonly shotCount: number;
  /** Mean overall score (0 = on target, lower better), or null. */
  readonly avgOverall: number | null;
  readonly issues: readonly RecurringIssue[];
  readonly trend: readonly TrendPoint[];
}

const round = (x: number, p: number): number => {
  const f = 10 ** p;
  return Math.round(x * f) / f;
};

export interface SummarizeOptions {
  readonly window: InsightsWindow;
  /** Max recurring issues to return (default 8). */
  readonly maxIssues?: number;
}

/** Aggregates scored shots into the window summary (recurring issues + trend). */
export function summarizeInsights(
  shots: readonly ScoredShotAt[],
  opts: SummarizeOptions,
): InsightsSummary {
  const maxIssues = opts.maxIssues ?? 8;
  const sorted = [...shots].sort((a, b) => a.createdAt - b.createdAt);
  const shotCount = sorted.length;

  const overalls = sorted
    .map((s) => s.scorecard.overall)
    .filter((n): n is number => n !== null);
  const avgOverall =
    overalls.length > 0
      ? round(overalls.reduce((a, b) => a + b, 0) / overalls.length, 1)
      : null;

  const trend: TrendPoint[] = sorted.map((s) => ({
    t: s.createdAt,
    overall: s.scorecard.overall,
  }));

  interface Agg {
    label: string;
    phase: string;
    kind: string;
    count: number;
    scoreSum: number;
    phrases: Map<string, number>;
  }
  const agg = new Map<string, Agg>();
  for (const s of sorted) {
    for (const w of s.scorecard.worst) {
      if (w.score === null || w.score <= 0) continue;
      const e =
        agg.get(w.id) ??
        ({
          label: w.label,
          phase: w.phase,
          kind: w.kind,
          count: 0,
          scoreSum: 0,
          phrases: new Map(),
        } satisfies Agg);
      e.count += 1;
      e.scoreSum += w.score;
      if (w.phrase) e.phrases.set(w.phrase, (e.phrases.get(w.phrase) ?? 0) + 1);
      agg.set(w.id, e);
    }
  }

  const issues: RecurringIssue[] = [...agg.entries()]
    .map(([id, e]) => {
      const avgScore = e.scoreSum / e.count;
      const phrase =
        [...e.phrases.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        id,
        label: e.label,
        phase: e.phase,
        kind: e.kind,
        phrase,
        occurrences: e.count,
        frequency: shotCount > 0 ? round(e.count / shotCount, 3) : 0,
        avgScore: round(avgScore, 1),
        rank: round(e.count * avgScore, 3),
      };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, maxIssues);

  return { window: opts.window, shotCount, avgOverall, issues, trend };
}
