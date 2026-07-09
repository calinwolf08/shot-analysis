/**
 * Pure rep-level scoring engine — design doc §Scoring System.
 *
 * Per numeric metric (side-specific half-range when the ideal isn't
 * centered in the acceptable range):
 *   halfRange = (side of range the value falls on)
 *   deadband  = deadbandFraction × halfRange
 *   dev       = |value − ideal|
 *   score     = 1                                       dev ≤ deadband
 *             = 1 − 0.5(dev−deadband)/(halfRange−deadband)   inside acceptable
 *             = 0.5·max(0, 1 − (dev−halfRange)/halfRange)    outside
 * Categorical: 1 if accepted, else categoricalMissScore.
 * Metrics with confidence < minMetricConfidence are excluded (not zeroed).
 */
import type { ShotAnalysis } from "basketball-shot-analysis";
import {
  METRIC_CATEGORIES,
  type BenchmarkProfile,
  type BenchmarkTarget,
  type MetricCategory,
  type MetricName,
} from "$lib/features/benchmarks";
import {
  DEFAULT_SCORING_CONFIG,
  SCORING_VERSION,
  type DeviationDirection,
  type ExcludedMetric,
  type MetricScore,
  type MetricStatus,
  type RepScore,
  type ScoringConfig,
} from "./types";

export interface NumericScoreResult {
  score: number;
  deviation: number;
  direction: DeviationDirection;
}

/** Scores a numeric value against a numeric target. Exported for tests. */
export function scoreNumeric(
  value: number,
  ideal: number,
  min: number,
  max: number,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): NumericScoreResult {
  const deviation = Math.abs(value - ideal);
  const direction: DeviationDirection =
    deviation === 0 ? null : value < ideal ? "low" : "high";

  // Side-specific half-range: distance from ideal to the bound on the side
  // the value falls on (equals (max−min)/2 when the ideal is centered).
  const halfRange = value < ideal ? ideal - min : max - ideal;
  if (halfRange <= 0) {
    // Degenerate target (ideal on the bound): only exact hits score 1.
    return { score: deviation === 0 ? 1 : 0, deviation, direction };
  }

  const deadband = config.deadbandFraction * halfRange;
  let score: number;
  if (deviation <= deadband) {
    score = 1;
  } else if (deviation <= halfRange) {
    score = 1 - (0.5 * (deviation - deadband)) / (halfRange - deadband);
  } else {
    score = 0.5 * Math.max(0, 1 - (deviation - halfRange) / halfRange);
  }
  return { score, deviation, direction };
}

function statusFor(score: number, config: ScoringConfig): MetricStatus {
  if (score >= config.passThreshold) return "pass";
  if (score >= config.warningThreshold) return "warning";
  return "fail";
}

function scoreMetric(
  metric: MetricName,
  value: number | string,
  confidence: number,
  target: BenchmarkTarget,
  config: ScoringConfig,
): MetricScore {
  let score: number;
  let deviation: number | null;
  let direction: DeviationDirection;

  if (typeof value === "number" && !Array.isArray(target.acceptable)) {
    const r = scoreNumeric(
      value,
      target.ideal as number,
      target.acceptable.min,
      target.acceptable.max,
      config,
    );
    score = r.score;
    deviation = r.deviation;
    direction = r.direction;
  } else if (typeof value === "string" && Array.isArray(target.acceptable)) {
    const accepted = target.acceptable.includes(value);
    score = accepted ? 1 : config.categoricalMissScore;
    deviation = null;
    direction = accepted ? null : "incorrect";
  } else {
    // Type mismatch between analysis output and target — treat as a miss.
    score = config.categoricalMissScore;
    deviation = null;
    direction = "incorrect";
  }

  const priorityWeight = config.priorityWeights[target.priority];
  return {
    metric,
    category: target.category,
    score,
    value,
    ideal: target.ideal,
    deviation,
    direction,
    status:
      typeof value === "string" && direction === "incorrect"
        ? "fail"
        : statusFor(score, config),
    weight: priorityWeight * confidence,
    confidence,
  };
}

/** Scores one analyzed shot against a benchmark. Pure and deterministic. */
export function scoreRep(
  shot: ShotAnalysis,
  benchmark: BenchmarkProfile,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): RepScore {
  const perMetric: Partial<Record<MetricName, MetricScore>> = {};
  const excludedMetrics: ExcludedMetric[] = [];

  for (const [name, metricValue] of Object.entries(shot.metrics)) {
    const target = benchmark.targets[name as MetricName];
    if (!target) {
      excludedMetrics.push({
        metric: name,
        reason: "no-target",
        confidence: metricValue.confidence,
      });
      continue;
    }
    if (metricValue.confidence < config.minMetricConfidence) {
      excludedMetrics.push({
        metric: name,
        reason: "low-confidence",
        confidence: metricValue.confidence,
      });
      continue;
    }
    perMetric[name as MetricName] = scoreMetric(
      name as MetricName,
      metricValue.value,
      metricValue.confidence,
      target,
      config,
    );
  }

  const scored = Object.values(perMetric) as MetricScore[];
  const formScore = weightedMean(scored);

  const perCategory = {} as Record<MetricCategory, number | null>;
  for (const category of METRIC_CATEGORIES) {
    perCategory[category] = weightedMean(
      scored.filter((m) => m.category === category),
    );
  }

  return {
    formScore,
    perMetric,
    perCategory,
    excludedMetrics,
    scoringVersion: SCORING_VERSION,
  };
}

/** Weighted mean of metric scores × 100, null when nothing scorable. */
function weightedMean(metrics: readonly MetricScore[]): number | null {
  let sum = 0;
  let weightSum = 0;
  for (const m of metrics) {
    sum += m.score * m.weight;
    weightSum += m.weight;
  }
  if (weightSum <= 0) return null;
  return (sum / weightSum) * 100;
}
