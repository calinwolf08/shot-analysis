/**
 * Diagnosis engine — ranks what to fix first from a scored assessment.
 *
 * Per metric:
 *   severity = w_dev·(1 − meanFormScore)
 *            + w_var·(1 − consistencyScore)
 *            + w_pri·priorityNorm            (defaults 0.45 / 0.30 / 0.25)
 * Metrics collapse into issue groups (themes); groups rank by severity
 * with deterministic alphabetical tie-break; top 3 are surfaced.
 */
import type { BenchmarkProfile, MetricName } from "$lib/features/benchmarks";
import type {
  DeviationDirection,
  MetricScore,
  RepScore,
  SessionScore,
} from "$lib/features/scoring";
import {
  ISSUE_GROUP_INFO,
  issueGroupForMetric,
  type IssueGroupId,
} from "./issue-groups";

export interface DiagnosisWeights {
  deviation: number;
  variance: number;
  priority: number;
}

export const DEFAULT_DIAGNOSIS_WEIGHTS: DiagnosisWeights = {
  deviation: 0.45,
  variance: 0.3,
  priority: 0.25,
};

export interface MetricDiagnosis {
  metric: MetricName;
  severity: number;
  /** Mean 0–1 form score across reps. */
  meanScore: number;
  /** 0–1 consistency for this metric (1 when unknown). */
  consistencyScore: number;
  priorityNorm: number;
  /** Dominant deviation direction across reps. */
  direction: DeviationDirection;
  displayName: string;
  shortCue: string;
  feedback: string | null;
}

export interface FocusArea {
  issueGroup: IssueGroupId;
  displayName: string;
  whyItMatters: string;
  severity: number;
  rank: number;
  /** Top-3 flag for the results screen. */
  surfaced: boolean;
  metrics: MetricDiagnosis[];
}

export function diagnose(
  sessionScore: SessionScore,
  repScores: readonly RepScore[],
  benchmark: BenchmarkProfile,
  weights: DiagnosisWeights = DEFAULT_DIAGNOSIS_WEIGHTS,
): FocusArea[] {
  // Aggregate per-metric evidence across reps (low-confidence metrics never
  // appear in RepScore.perMetric, so they are filtered by construction).
  const byMetric = new Map<
    MetricName,
    { scores: number[]; weights: number[]; directions: DeviationDirection[] }
  >();
  for (const rep of repScores) {
    for (const m of Object.values(rep.perMetric) as MetricScore[]) {
      let entry = byMetric.get(m.metric);
      if (!entry) {
        entry = { scores: [], weights: [], directions: [] };
        byMetric.set(m.metric, entry);
      }
      entry.scores.push(m.score);
      entry.weights.push(m.weight);
      entry.directions.push(m.direction);
    }
  }

  const consistencyByMetric = new Map(
    sessionScore.breakdown.perMetricConsistency.map((c) => [c.metric, c.score]),
  );

  const metricDiagnoses: MetricDiagnosis[] = [];
  for (const [metric, entry] of byMetric) {
    const target = benchmark.targets[metric];
    if (!target) continue;
    const group = issueGroupForMetric(metric);
    if (!group) continue;

    const meanScore =
      entry.scores.reduce((s, v) => s + v, 0) / entry.scores.length;
    const consistencyScore = consistencyByMetric.get(metric) ?? 1;
    const priorityNorm =
      target.priority === "high"
        ? 1
        : target.priority === "medium"
          ? 2 / 3
          : 1 / 3;

    const severity =
      weights.deviation * (1 - meanScore) +
      weights.variance * (1 - consistencyScore) +
      weights.priority * priorityNorm;

    const direction = dominantDirection(entry.directions);
    let feedback: string | null = null;
    if (direction === "low") feedback = target.feedback.tooLow ?? null;
    else if (direction === "high") feedback = target.feedback.tooHigh ?? null;
    else if (direction === "incorrect")
      feedback = target.feedback.incorrect ?? null;

    metricDiagnoses.push({
      metric,
      severity,
      meanScore,
      consistencyScore,
      priorityNorm,
      direction,
      displayName: target.displayName,
      shortCue: target.shortCue,
      feedback,
    });
  }

  // Collapse into issue groups. A group's severity is the weighted mean of
  // its members' severities, weighted by how wrong each member is
  // (1 − meanScore) + a floor so priorities still matter when all pass.
  const groups = new Map<IssueGroupId, MetricDiagnosis[]>();
  for (const d of metricDiagnoses) {
    const group = issueGroupForMetric(d.metric)!;
    const list = groups.get(group) ?? [];
    list.push(d);
    groups.set(group, list);
  }

  const areas: FocusArea[] = [];
  for (const [groupId, members] of groups) {
    const sorted = [...members].sort(
      (a, b) => b.severity - a.severity || a.metric.localeCompare(b.metric),
    );
    let weightSum = 0;
    let sum = 0;
    for (const m of sorted) {
      const w = 0.25 + (1 - m.meanScore);
      sum += m.severity * w;
      weightSum += w;
    }
    const info = ISSUE_GROUP_INFO[groupId];
    areas.push({
      issueGroup: groupId,
      displayName: info.displayName,
      whyItMatters: info.whyItMatters,
      severity: weightSum > 0 ? sum / weightSum : 0,
      rank: 0,
      surfaced: false,
      metrics: sorted,
    });
  }

  areas.sort(
    (a, b) =>
      b.severity - a.severity || a.issueGroup.localeCompare(b.issueGroup),
  );
  areas.forEach((area, i) => {
    area.rank = i + 1;
    area.surfaced = i < 3;
  });
  return areas;
}

function dominantDirection(
  directions: readonly DeviationDirection[],
): DeviationDirection {
  const counts = new Map<Exclude<DeviationDirection, null>, number>();
  for (const d of directions) {
    if (d === null) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  let best: DeviationDirection = null;
  let bestCount = 0;
  for (const [d, count] of counts) {
    if (count > bestCount || (count === bestCount && best && d < best)) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}
