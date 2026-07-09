/**
 * Aggregates per-metric evidence across a session's shots for the
 * all-metrics accordion: mean value, σ, status, confidence.
 */
import {
  METRIC_CATEGORIES,
  type BenchmarkProfile,
  type MetricCategory,
  type MetricName,
} from "$lib/features/benchmarks";
import { DEFAULT_SCORING_CONFIG, scoreRep } from "$lib/features/scoring";
import type { ShotRecord } from "$lib/shared/db/repos";

export interface MetricSummaryRow {
  metric: MetricName;
  displayName: string;
  category: MetricCategory;
  /** Formatted mean value ("87.2°", "side", "–" when absent). */
  valueText: string;
  idealText: string;
  rangeText: string;
  /** σ of the numeric value across shots, null for categorical/absent. */
  std: number | null;
  meanConfidence: number | null;
  status: "pass" | "warning" | "fail" | "low-confidence" | "no-data";
}

export type MetricsByCategory = Record<MetricCategory, MetricSummaryRow[]>;

const CATEGORY_LABELS: Record<MetricCategory, string> = {
  "shooting-arm": "Shooting arm",
  "guide-arm": "Guide arm",
  ball: "Ball path",
  "lower-body": "Lower body",
  posture: "Posture",
  timing: "Timing",
};

export function categoryLabel(category: MetricCategory): string {
  return CATEGORY_LABELS[category];
}

function formatValue(value: number | string, unit: string): string {
  if (typeof value === "string") return value;
  const rounded = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
  if (unit === "degrees") return `${rounded}°`;
  if (unit === "ms") return `${rounded} ms`;
  if (unit === "percent") return `${rounded}%`;
  return rounded;
}

export function summarizeMetrics(
  shots: readonly ShotRecord[],
  benchmark: BenchmarkProfile,
): MetricsByCategory {
  // Score every shot once; aggregate statuses via mean per-metric score.
  const reps = shots.map((s) => scoreRep(s.analysis, benchmark));

  const byCategory = Object.fromEntries(
    METRIC_CATEGORIES.map((c) => [c, [] as MetricSummaryRow[]]),
  ) as MetricsByCategory;

  for (const [name, target] of Object.entries(benchmark.targets)) {
    const metric = name as MetricName;
    const values: (number | string)[] = [];
    const confidences: number[] = [];
    const scores: number[] = [];

    for (let i = 0; i < shots.length; i++) {
      const mv = shots[i]!.analysis.metrics[metric];
      if (!mv) continue;
      values.push(mv.value);
      confidences.push(mv.confidence);
      const ms = reps[i]!.perMetric[metric];
      if (ms) scores.push(ms.score);
    }

    const numeric = values.filter((v): v is number => typeof v === "number");
    const meanConfidence =
      confidences.length > 0
        ? confidences.reduce((s, v) => s + v, 0) / confidences.length
        : null;

    let valueText = "–";
    let std: number | null = null;
    if (numeric.length > 0) {
      const mean = numeric.reduce((s, v) => s + v, 0) / numeric.length;
      valueText = formatValue(mean, unitOf(shots, metric));
      if (numeric.length > 1) {
        std = Math.sqrt(
          numeric.reduce((s, v) => s + (v - mean) ** 2, 0) / numeric.length,
        );
      }
    } else if (values.length > 0) {
      valueText = String(mode(values as string[]));
    }

    let status: MetricSummaryRow["status"];
    if (values.length === 0) {
      status = "no-data";
    } else if (scores.length === 0) {
      status = "low-confidence"; // present but always below the threshold
    } else {
      const meanScore = scores.reduce((s, v) => s + v, 0) / scores.length;
      status =
        meanScore >= DEFAULT_SCORING_CONFIG.passThreshold
          ? "pass"
          : meanScore >= DEFAULT_SCORING_CONFIG.warningThreshold
            ? "warning"
            : "fail";
    }

    byCategory[target.category].push({
      metric,
      displayName: target.displayName,
      category: target.category,
      valueText,
      idealText:
        typeof target.ideal === "number"
          ? formatValue(target.ideal, unitOf(shots, metric))
          : String(target.ideal),
      rangeText: Array.isArray(target.acceptable)
        ? target.acceptable.join(" / ")
        : `${target.acceptable.min}–${target.acceptable.max}`,
      std,
      meanConfidence,
      status,
    });
  }

  for (const category of METRIC_CATEGORIES) {
    byCategory[category].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }
  return byCategory;
}

function unitOf(shots: readonly ShotRecord[], metric: MetricName): string {
  for (const shot of shots) {
    const mv = shot.analysis.metrics[metric];
    if (mv) return mv.unit;
  }
  return "";
}

function mode(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}
