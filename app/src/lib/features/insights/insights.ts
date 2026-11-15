/**
 * Insights aggregation (live redesign — step 8).
 *
 * Pure read-model over a set of scored shots: for a time window it ranks the
 * recurring issues (metrics that land off-target most often and most severely)
 * and builds the overall-score trend. No session concept — shots are grouped
 * purely by their timestamp, and scores are recomputed from stored metrics by
 * the caller (`scorecardForShot`), never stored.
 *
 * @see docs/live-redesign-plan.md §3.10
 */
import type { Section, ShotScorecard } from "$lib/features/scoring";

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
  readonly scorecard: ShotScorecard;
}

export interface RecurringIssue {
  readonly id: string;
  readonly label: string;
  readonly section: Section;
  readonly phase: string;
  /** Shots (in the window) where this metric was off-target. */
  readonly occurrences: number;
  /** occurrences / shotCount (0..1). */
  readonly frequency: number;
  /** Mean normalized deviation across the off-target shots. */
  readonly avgNormDev: number;
  /** Mean 1..10 score across the off-target shots. */
  readonly avgScore: number;
  /** Ranking weight = occurrences × avgNormDev (frequency × severity). */
  readonly rank: number;
}

export interface TrendPoint {
  readonly t: number;
  readonly overall: number | null;
}

export interface InsightsSummary {
  readonly window: InsightsWindow;
  readonly shotCount: number;
  /** Mean overall score (1..10, lower better), or null when nothing scored. */
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
    section: Section;
    phase: string;
    count: number;
    normDevSum: number;
    scoreSum: number;
  }
  const agg = new Map<string, Agg>();
  for (const s of sorted) {
    for (const w of s.scorecard.worst) {
      const e =
        agg.get(w.id) ??
        ({
          label: w.label,
          section: w.section,
          phase: w.phase,
          count: 0,
          normDevSum: 0,
          scoreSum: 0,
        } satisfies Agg);
      e.count += 1;
      e.normDevSum += w.normDev;
      e.scoreSum += w.score;
      agg.set(w.id, e);
    }
  }

  const issues: RecurringIssue[] = [...agg.entries()]
    .map(([id, e]) => {
      const avgNormDev = e.normDevSum / e.count;
      return {
        id,
        label: e.label,
        section: e.section,
        phase: e.phase,
        occurrences: e.count,
        frequency: shotCount > 0 ? round(e.count / shotCount, 3) : 0,
        avgNormDev: round(avgNormDev, 3),
        avgScore: round(e.scoreSum / e.count, 1),
        rank: round(e.count * avgNormDev, 3),
      };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, maxIssues);

  return { window: opts.window, shotCount, avgOverall, issues, trend };
}
