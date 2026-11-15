/**
 * Scoring engine (metrics overhaul Step 7).
 *
 * Scores a shot's measured metrics against reference thresholds and rolls them
 * up into a Sequencing Score and a Structure Score, each broken into
 * categories → metrics. UI-ready: every metric carries its value, target band,
 * status, and the frame it was measured at.
 *
 * Rules:
 *  - 100 inside the band, smoothstep falloff to 0 at ~2 band-widths outside.
 *  - Sequencing gaps whose sign violates the expected order are penalized hard.
 *  - Unreliable / missing / reported-only metrics don't score; the fraction of
 *    metrics actually measured is reported so the UI can be honest about gaps.
 *
 * @see docs/implementation-plan-metrics-overhaul.md
 */

import { flattenMetrics, type FlatMetric } from "../../metrics/v2/flatten";
import type { ShotMetricsV2 } from "../../metrics/v2/types";
import {
  categoryLabel,
  type MetricThreshold,
  type Thresholds,
} from "../../metrics/v2/thresholds";

export type MetricStatus = "good" | "close" | "off" | "unmeasured";

export interface MetricScore {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly value: number | null;
  readonly band: readonly [number, number];
  readonly weight: number;
  readonly reportedOnly: boolean;
  readonly status: MetricStatus;
  readonly score: number | null;
  readonly frame: number | null;
}

export interface CategoryScore {
  readonly id: string;
  readonly label: string;
  readonly score: number | null;
  readonly measuredFraction: number;
  readonly metrics: readonly MetricScore[];
}

export interface ShotScore {
  readonly sequencing: {
    readonly score: number | null;
    readonly orderScore: number | null;
    readonly measuredFraction: number;
    readonly metrics: readonly MetricScore[];
  };
  readonly structure: {
    readonly score: number | null;
    readonly measuredFraction: number;
    readonly categories: readonly CategoryScore[];
  };
}

const STRUCTURE_CATEGORIES = [
  "gather",
  "load",
  "rise",
  "setPoint",
  "release",
  "followThrough",
] as const;

const clamp = (x: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, x));
const smoothstep = (x: number): number => x * x * (3 - 2 * x);

/** 0..100 score of a value against a band (100 inside, falloff outside). */
function bandScore(value: number, band: readonly [number, number]): number {
  const [lo, hi] = band;
  const width = Math.max(hi - lo, 1e-6);
  if (value >= lo && value <= hi) return 100;
  const d = value < lo ? lo - value : value - hi;
  const K = 2; // reaches 0 at K band-widths outside
  const s = clamp(1 - d / (K * width), 0, 1);
  return 100 * smoothstep(s);
}

/** Does a sequencing value violate the order the band expects? */
function violatesOrder(id: string, value: number, band: readonly [number, number]): boolean {
  if (!id.startsWith("seq.")) return false;
  const mid = (band[0] + band[1]) / 2;
  if (mid > 0) return value <= 0; // expected later-after-earlier but it wasn't
  if (mid < 0) return value >= 0;
  return false;
}

function statusOf(score: number): MetricStatus {
  if (score >= 75) return "good";
  if (score >= 40) return "close";
  return "off";
}

function scoreOne(
  id: string,
  th: MetricThreshold,
  flat: Map<string, FlatMetric>,
): MetricScore {
  const m = flat.get(id);
  const base = {
    id,
    label: th.label,
    category: th.category,
    band: th.band,
    weight: th.weight,
    reportedOnly: th.reportedOnly,
  };
  // No reliable reading in this shot → unmeasured.
  if (!m || !m.reliable || !Number.isFinite(m.value)) {
    return { ...base, value: null, status: "unmeasured", score: null, frame: null };
  }
  let score = bandScore(m.value, th.band);
  if (violatesOrder(id, m.value, th.band)) score = Math.min(score, 10);
  const frame = m.frames.length ? m.frames[m.frames.length - 1]! : null;
  return {
    ...base,
    value: m.value,
    status: statusOf(score),
    score,
    frame,
  };
}

/** Weighted mean of the scored (weight>0) metrics; null when none scored. */
function weightedMean(metrics: readonly MetricScore[]): number | null {
  let sum = 0;
  let wsum = 0;
  for (const m of metrics) {
    if (m.score === null || m.weight <= 0) continue;
    sum += m.score * m.weight;
    wsum += m.weight;
  }
  return wsum > 0 ? sum / wsum : null;
}

/** Fraction of scoreable (weight>0) metrics that were actually measured. */
function measuredFraction(metrics: readonly MetricScore[]): number {
  const scoreable = metrics.filter((m) => m.weight > 0);
  if (scoreable.length === 0) return 1;
  const measured = scoreable.filter((m) => m.score !== null).length;
  return measured / scoreable.length;
}

export function scoreShot(metrics: ShotMetricsV2, thresholds: Thresholds): ShotScore {
  const flat = new Map<string, FlatMetric>();
  for (const f of flattenMetrics(metrics)) flat.set(f.id, f);

  const all: MetricScore[] = Object.entries(thresholds.metrics).map(([id, th]) =>
    scoreOne(id, th, flat),
  );

  // --- Sequencing ---
  const seqMetrics = all.filter((m) => m.category === "sequencing");
  const orderScored = seqMetrics.filter(
    (m) => m.weight > 0 && m.value !== null,
  );
  const orderOk = orderScored.filter((m) => !violatesOrder(m.id, m.value!, m.band)).length;
  const orderScore = orderScored.length > 0 ? (100 * orderOk) / orderScored.length : null;

  // --- Structure ---
  const categories: CategoryScore[] = [];
  for (const cat of STRUCTURE_CATEGORIES) {
    const catMetrics = all.filter((m) => m.category === cat);
    if (catMetrics.length === 0) continue;
    categories.push({
      id: cat,
      label: categoryLabel(cat),
      score: weightedMean(catMetrics),
      measuredFraction: measuredFraction(catMetrics),
      metrics: catMetrics,
    });
  }
  const catScores = categories.map((c) => c.score).filter((s): s is number => s !== null);
  const structureScore = catScores.length ? catScores.reduce((a, b) => a + b, 0) / catScores.length : null;

  return {
    sequencing: {
      score: weightedMean(seqMetrics),
      orderScore,
      measuredFraction: measuredFraction(seqMetrics),
      metrics: seqMetrics,
    },
    structure: {
      score: structureScore,
      measuredFraction: measuredFraction(all.filter((m) => m.category !== "sequencing")),
      categories,
    },
  };
}
