/**
 * Session-summary derivations: which issues improved or appeared between
 * the first and second half of a live session's reps.
 */
import type { MetricName } from "$lib/features/benchmarks";
import type { RepScore } from "$lib/features/scoring";

export interface HalvesComparison {
  /** Metrics whose mean score rose by ≥ threshold half-over-half. */
  improved: MetricName[];
  /** Metrics whose mean score dropped by ≥ threshold (new issues). */
  appeared: MetricName[];
}

/**
 * Compares per-metric mean scores between the first and second half of
 * the session. Needs at least 4 reps (2 per half) to say anything.
 */
export function compareHalves(
  repScores: readonly RepScore[],
  threshold = 0.15,
): HalvesComparison {
  if (repScores.length < 4) return { improved: [], appeared: [] };
  const mid = Math.floor(repScores.length / 2);
  const first = meanByMetric(repScores.slice(0, mid));
  const second = meanByMetric(repScores.slice(mid));

  const improved: MetricName[] = [];
  const appeared: MetricName[] = [];
  const metrics = new Set([...first.keys(), ...second.keys()]);
  for (const metric of [...metrics].sort()) {
    const a = first.get(metric);
    const b = second.get(metric);
    if (a === undefined || b === undefined) continue; // not in both halves
    if (b - a >= threshold) improved.push(metric);
    else if (a - b >= threshold) appeared.push(metric);
  }
  return { improved, appeared };
}

function meanByMetric(reps: readonly RepScore[]): Map<MetricName, number> {
  const sums = new Map<MetricName, { total: number; n: number }>();
  for (const rep of reps) {
    for (const [metric, ms] of Object.entries(rep.perMetric)) {
      if (!ms) continue;
      const entry = sums.get(metric as MetricName) ?? { total: 0, n: 0 };
      entry.total += ms.score;
      entry.n += 1;
      sums.set(metric as MetricName, entry);
    }
  }
  const means = new Map<MetricName, number>();
  for (const [metric, { total, n }] of sums) means.set(metric, total / n);
  return means;
}
