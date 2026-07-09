import type {
  BenchmarkProfile,
  MetricCategory,
  MetricName,
} from "$lib/features/benchmarks";

/** Bump when scoring formulas change; persisted with every score row. */
export const SCORING_VERSION = 1;

export type MetricStatus = "pass" | "warning" | "fail";
export type DeviationDirection = "low" | "high" | "incorrect" | null;

export interface MetricScore {
  metric: MetricName;
  category: MetricCategory;
  /** Normalized score in [0, 1]. */
  score: number;
  value: number | string;
  ideal: number | string;
  /** |value − ideal| for numeric metrics, null for categorical. */
  deviation: number | null;
  direction: DeviationDirection;
  status: MetricStatus;
  /** priorityWeight × confidence — the weight used in aggregation. */
  weight: number;
  confidence: number;
}

export type ExclusionReason = "low-confidence" | "no-target";

export interface ExcludedMetric {
  metric: string;
  reason: ExclusionReason;
  confidence: number;
}

export interface RepScore {
  /** 0–100, null when no metric was scorable. */
  formScore: number | null;
  perMetric: Partial<Record<MetricName, MetricScore>>;
  /** 0–100 per category, null when the category had no scorable metric. */
  perCategory: Record<MetricCategory, number | null>;
  excludedMetrics: ExcludedMetric[];
  scoringVersion: number;
}

export interface Cue {
  metric: MetricName;
  /** Imperative short cue from the benchmark (spoken aloud). */
  text: string;
  direction: DeviationDirection;
  /** Longer feedback string for on-screen display. */
  feedback: string | null;
}

export interface CueSelection {
  primary: Cue | null;
  secondary: Cue[];
}

export interface ScoringConfig {
  /** Metrics below this confidence are excluded (not zeroed). */
  minMetricConfidence: number;
  /** Deadband as a fraction of the (side-specific) half-range. */
  deadbandFraction: number;
  /** Score for a categorical miss. */
  categoricalMissScore: number;
  priorityWeights: { high: number; medium: number; low: number };
  /** MetricScore.status thresholds on the 0–1 score. */
  passThreshold: number;
  warningThreshold: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  minMetricConfidence: 0.4,
  deadbandFraction: 0.1,
  categoricalMissScore: 0.25,
  priorityWeights: { high: 3, medium: 2, low: 1 },
  passThreshold: 0.75,
  warningThreshold: 0.5,
};

export type Benchmark = BenchmarkProfile;
