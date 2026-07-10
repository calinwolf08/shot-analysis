/**
 * Session-level aggregation — design doc §Session scores.
 *
 * Consistency curve: score = exp(−K·CV^P), with K/P solved so that
 * CV 0.05 → ≈0.95 and CV 0.25 → ≈0.55 (the design's calibration points —
 * a single-exponent exp(−k·CV) cannot hit both).
 */
import type { ShotAnalysis } from "basketball-shot-analysis";
import type { BenchmarkProfile, MetricName } from "$lib/features/benchmarks";
import {
  DEFAULT_SCORING_CONFIG,
  SCORING_VERSION,
  type MetricScore,
  type RepScore,
  type ScoringConfig,
} from "./types";

/** Movement-economy subset driving the Efficiency & Simplicity score. */
export const EFFICIENCY_METRICS: readonly MetricName[] = [
  "ballPath",
  "ballDip",
  "setPointDuration",
  "totalShotDuration",
  "ballLegSync",
  "legExtensionStart",
  "guideHandRelease",
];

const CONSISTENCY_K = 4.968;
const CONSISTENCY_P = 1.526;
/** Reps needed before consistency is meaningful. */
const MIN_REPS_FOR_CONSISTENCY = 3;
/** Reps needed before the trimmed mean kicks in. */
const MIN_REPS_FOR_TRIM = 8;

export interface SessionScoreWeights {
  form: number;
  consistency: number;
  efficiency: number;
}

export const DEFAULT_SESSION_WEIGHTS: SessionScoreWeights = {
  form: 0.5,
  consistency: 0.3,
  efficiency: 0.2,
};

export interface MetricConsistency {
  metric: MetricName;
  mean: number;
  std: number;
  cv: number;
  /** exp(−K·cv^P), 0..1 */
  score: number;
  weight: number;
  usedHalfRange: boolean;
}

export interface SessionScore {
  form: number | null;
  consistency: number | null;
  efficiency: number | null;
  overall: number | null;
  breakdown: SessionBreakdown;
  scoringVersion: number;
}

export interface SessionBreakdown {
  repCount: number;
  scoredRepCount: number;
  trimmed: boolean;
  repFormScores: (number | null)[];
  perMetricConsistency: MetricConsistency[];
  efficiencyMetricsUsed: MetricName[];
  weights: SessionScoreWeights;
  appliedWeights: SessionScoreWeights;
  benchmarkId: string;
}

export function consistencyCurve(cv: number): number {
  return Math.exp(-CONSISTENCY_K * Math.pow(Math.max(0, cv), CONSISTENCY_P));
}

function trimmedMean(values: number[], enabled: boolean): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  let trimmed = sorted;
  if (enabled && sorted.length >= MIN_REPS_FOR_TRIM) {
    const k = Math.max(1, Math.floor(sorted.length * 0.1));
    trimmed = sorted.slice(k, sorted.length - k);
  }
  return trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
}

function computeConsistency(
  shots: readonly ShotAnalysis[],
  benchmark: BenchmarkProfile,
  config: ScoringConfig,
): MetricConsistency[] {
  const perMetric: MetricConsistency[] = [];

  const metricNames = new Set<string>();
  for (const shot of shots) {
    for (const name of Object.keys(shot.metrics)) metricNames.add(name);
  }

  for (const name of metricNames) {
    const target = benchmark.targets[name as MetricName];
    if (!target || Array.isArray(target.acceptable)) continue; // numeric only

    const values: number[] = [];
    let unit = "";
    for (const shot of shots) {
      const m = shot.metrics[name];
      if (
        m &&
        typeof m.value === "number" &&
        m.confidence >= config.minMetricConfidence
      ) {
        values.push(m.value);
        unit = m.unit;
      }
    }
    if (values.length < MIN_REPS_FOR_CONSISTENCY) continue;

    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance =
      values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);

    const halfRange = (target.acceptable.max - target.acceptable.min) / 2;
    // Angle metrics (and any metric whose mean sits near zero) use the
    // benchmark half-range as the CV denominator instead of the mean.
    const useHalfRange = unit === "degrees" || Math.abs(mean) < 1e-6;
    const denom = useHalfRange ? halfRange : Math.abs(mean);
    if (denom <= 0) continue;

    const cv = std / denom;
    perMetric.push({
      metric: name as MetricName,
      mean,
      std,
      cv,
      score: consistencyCurve(cv),
      weight: config.priorityWeights[target.priority],
      usedHalfRange: useHalfRange,
    });
  }
  return perMetric.sort((a, b) => a.metric.localeCompare(b.metric));
}

function computeEfficiency(reps: readonly RepScore[]): {
  score: number | null;
  used: MetricName[];
} {
  let sum = 0;
  let weightSum = 0;
  const used = new Set<MetricName>();
  for (const rep of reps) {
    for (const name of EFFICIENCY_METRICS) {
      const m: MetricScore | undefined = rep.perMetric[name];
      if (!m) continue;
      sum += m.score * m.weight;
      weightSum += m.weight;
      used.add(name);
    }
  }
  if (weightSum <= 0) return { score: null, used: [] };
  return { score: (sum / weightSum) * 100, used: [...used].sort() };
}

export interface ScoreSessionOptions {
  weights?: SessionScoreWeights;
  config?: ScoringConfig;
}

export function scoreSession(
  reps: readonly RepScore[],
  shots: readonly ShotAnalysis[],
  benchmark: BenchmarkProfile,
  options: ScoreSessionOptions = {},
): SessionScore {
  const weights = options.weights ?? DEFAULT_SESSION_WEIGHTS;
  const config = options.config ?? DEFAULT_SCORING_CONFIG;

  const formScores = reps
    .map((r) => r.formScore)
    .filter((v): v is number => v !== null);
  const form = trimmedMean(formScores, true);
  const trimmed = formScores.length >= MIN_REPS_FOR_TRIM;

  const perMetricConsistency =
    shots.length >= MIN_REPS_FOR_CONSISTENCY
      ? computeConsistency(shots, benchmark, config)
      : [];
  let consistency: number | null = null;
  if (perMetricConsistency.length > 0) {
    let sum = 0;
    let weightSum = 0;
    for (const m of perMetricConsistency) {
      sum += m.score * m.weight;
      weightSum += m.weight;
    }
    consistency = (sum / weightSum) * 100;
  }

  const efficiencyResult = computeEfficiency(reps);
  const efficiency = efficiencyResult.score;

  // Overall: configured weights over the available components, renormalized
  // when a component is null (e.g. consistency needs ≥ 3 reps).
  const parts: [number | null, number][] = [
    [form, weights.form],
    [consistency, weights.consistency],
    [efficiency, weights.efficiency],
  ];
  let overallSum = 0;
  let overallWeight = 0;
  const applied: SessionScoreWeights = {
    form: 0,
    consistency: 0,
    efficiency: 0,
  };
  for (const [value, weight] of parts) {
    if (value === null) continue;
    overallSum += value * weight;
    overallWeight += weight;
  }
  if (overallWeight > 0) {
    applied.form = form !== null ? weights.form / overallWeight : 0;
    applied.consistency =
      consistency !== null ? weights.consistency / overallWeight : 0;
    applied.efficiency =
      efficiency !== null ? weights.efficiency / overallWeight : 0;
  }
  const overall = overallWeight > 0 ? overallSum / overallWeight : null;

  return {
    form,
    consistency,
    efficiency,
    overall,
    breakdown: {
      repCount: reps.length,
      scoredRepCount: formScores.length,
      trimmed,
      repFormScores: reps.map((r) => r.formScore),
      perMetricConsistency,
      efficiencyMetricsUsed: efficiencyResult.used,
      weights,
      appliedWeights: applied,
      benchmarkId: benchmark.id,
    },
    scoringVersion: SCORING_VERSION,
  };
}
