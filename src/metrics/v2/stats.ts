/**
 * Small robust statistics used to summarize a metric across clips / players.
 * Median + IQR rather than mean + stddev so a single bad clip doesn't skew the
 * reference band.
 */

export interface Stats {
  readonly n: number;
  readonly median: number;
  readonly min: number;
  readonly max: number;
  readonly p25: number;
  readonly p75: number;
  readonly iqr: number;
}

/** Linear-interpolated quantile of a pre-sorted ascending array. */
function quantileSorted(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

/** Summary stats of finite values, or null when there are none. */
export function summarize(values: readonly number[]): Stats | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const p25 = quantileSorted(v, 0.25);
  const p75 = quantileSorted(v, 0.75);
  return {
    n: v.length,
    median: quantileSorted(v, 0.5),
    min: v[0]!,
    max: v[v.length - 1]!,
    p25,
    p75,
    iqr: p75 - p25,
  };
}
