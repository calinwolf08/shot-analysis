/**
 * Threshold derivation (metrics overhaul Step 6).
 *
 * Turns per-player metric summaries into a consensus band per metric, and
 * ranks metrics by how TIGHTLY the pros agree. Metrics where every pro lands in
 * a narrow band (small between-player spread relative to within-player noise)
 * are the "truly key" ones — high weight; metrics where pros legitimately
 * differ are reported-only (weight 0). Scoring (Step 7) consumes this.
 *
 * @see docs/implementation-plan-metrics-overhaul.md
 */

import type { Stats } from "./stats";

export const THRESHOLDS_VERSION = 1 as const;

export interface MetricThreshold {
  /** Consensus band [lo, hi] the metric should fall in. */
  readonly band: readonly [number, number];
  /** Scoring weight (0..1). 0 = reported-only (pros differ / low coverage). */
  readonly weight: number;
  /** 0..1: how tightly the pros agree (between vs within-player spread). */
  readonly tightness: number;
  /** Fraction of reference players that had a reliable reading (0..1). */
  readonly coverage: number;
  /** Category this metric rolls up into (sequencing or a structure phase). */
  readonly category: string;
  /** Human-readable label. */
  readonly label: string;
  /** True when weight is 0 — shown to users but not scored. */
  readonly reportedOnly: boolean;
}

export interface Thresholds {
  readonly version: number;
  readonly generatedFrom: readonly string[];
  readonly metrics: Readonly<Record<string, MetricThreshold>>;
}

/** One reference player's summary: per-metric stats (or null when absent). */
export interface PlayerSummary {
  readonly player: string;
  readonly metrics: Readonly<Record<string, Stats | null>>;
}

export interface DeriveOptions {
  /** Below this tightness a metric is reported-only. Default 0.25. */
  readonly reportOnlyTightness?: number;
  /** Below this coverage a metric is reported-only. Default 0.5. */
  readonly minCoverage?: number;
  /** Band padding as a multiple of pooled within-player IQR. Default 0.5. */
  readonly iqrPad?: number;
}

/** Category a metric id rolls up into. */
export function categoryOf(id: string): string {
  if (id.startsWith("seq.")) return "sequencing";
  const dot = id.indexOf(".");
  return dot > 0 ? id.slice(0, dot) : "other";
}

const CATEGORY_LABELS: Record<string, string> = {
  sequencing: "Sequencing",
  gather: "Gather",
  load: "Load",
  rise: "Rise",
  setPoint: "Set Point",
  release: "Release",
  followThrough: "Follow-through",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** Prettifies a metric id into a human label. */
export function labelFor(id: string): string {
  if (id.startsWith("seq.")) {
    const [from, to] = id.slice(4).split("__");
    return `${pretty(from)} → ${pretty(to)}`;
  }
  const dot = id.indexOf(".");
  const key = dot > 0 ? id.slice(dot + 1) : id;
  return pretty(key);
}

function pretty(s: string | undefined): string {
  if (!s) return "";
  return s
    .replace(/_/g, " ")
    .replace(/\bvs\b/g, "vs")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function median(nums: number[]): number {
  const v = [...nums].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

/**
 * Derives thresholds from the reference players' summaries.
 */
export function deriveThresholds(
  summaries: readonly PlayerSummary[],
  opts: DeriveOptions = {},
): Thresholds {
  const reportOnlyTightness = opts.reportOnlyTightness ?? 0.25;
  const minCoverage = opts.minCoverage ?? 0.5;
  const iqrPad = opts.iqrPad ?? 0.5;
  const totalPlayers = summaries.length;

  // Collect all metric ids seen across players.
  const ids = new Set<string>();
  for (const s of summaries) for (const id of Object.keys(s.metrics)) ids.add(id);

  const metrics: Record<string, MetricThreshold> = {};
  for (const id of [...ids].sort()) {
    const playerMedians: number[] = [];
    const playerIqrs: number[] = [];
    for (const s of summaries) {
      const st = s.metrics[id];
      if (st && Number.isFinite(st.median)) {
        playerMedians.push(st.median);
        playerIqrs.push(Number.isFinite(st.iqr) ? st.iqr : 0);
      }
    }
    if (playerMedians.length === 0) continue;

    const coverage = playerMedians.length / Math.max(1, totalPlayers);
    const lo = Math.min(...playerMedians);
    const hi = Math.max(...playerMedians);
    const betweenSpread = hi - lo;
    const pooledIqr = playerIqrs.length ? median(playerIqrs) : 0;

    // Tightness: pros agree when the between-player spread is small relative to
    // the natural within-player noise. spread==0 -> 1; spread==pooledIqr -> 0.5.
    const tightness = pooledIqr + betweenSpread > 0
      ? pooledIqr / (pooledIqr + betweenSpread)
      : 1;

    const pad = iqrPad * pooledIqr;
    const band: [number, number] = [lo - pad, hi + pad];
    const reportedOnly =
      tightness < reportOnlyTightness || coverage < minCoverage;
    const weight = reportedOnly ? 0 : tightness * coverage;

    metrics[id] = {
      band,
      weight,
      tightness,
      coverage,
      category: categoryOf(id),
      label: labelFor(id),
      reportedOnly,
    };
  }

  return {
    version: THRESHOLDS_VERSION,
    generatedFrom: summaries.map((s) => s.player),
    metrics,
  };
}
