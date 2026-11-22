/**
 * Leftover camera-angle error, measured from the data itself
 * (docs/pro-targets-plan.md, Phase 4).
 *
 * A shooter's form doesn't depend on where the camera stood, so if a metric
 * still drifts with the camera angle after the 1/cos correction, the drift is
 * measurement error (sideways movement leaking in, MediaPipe's own oblique-
 * angle errors, a biased angle estimate). Fit it per metric WITHIN players —
 * each player's values and angles taken relative to that player's own means,
 * so differences between players can't pose as an angle effect — and, where
 * the slope is clearly real, bring every attempt to its 0° equivalent:
 *
 *   value₀ = value − slope × |angle|
 *
 * Also reported: how the residual spread grows with the angle (to tune each
 * metric's angle limit), and timing metrics with a slope (they shouldn't
 * have one — a sign of a bug). Pure.
 */
import type { MeasuredAttempt } from "./build";

export interface TrendConfig {
  /** Fit at all (needs enough data). */
  readonly enabled: boolean;
  /** Minimum attempts with the metric (across players). */
  readonly minAttempts: number;
  /** Minimum players contributing ≥ 2 attempts. */
  readonly minPlayers: number;
  /** Minimum within-player angle spread (deg, SD) to fit a slope. */
  readonly minAngleSpread: number;
  /** |slope / standard error| needed to call the slope real. */
  readonly t: number;
}

export const DEFAULT_TREND_CONFIG: TrendConfig = {
  enabled: true,
  minAttempts: 20,
  minPlayers: 3,
  minAngleSpread: 4,
  t: 2.5,
};

export interface AngleTrend {
  readonly id: string;
  /** Change in value per degree off side-on (metric units / deg). */
  readonly slope: number;
  readonly standardError: number;
  readonly attempts: number;
  readonly players: number;
  /** Within-player angle SD (deg). */
  readonly angleSpread: number;
  /** Enough data and |slope| ≥ t × SE: applied. */
  readonly significant: boolean;
  /** Why it isn't fitted / applied (null when significant). */
  readonly reason: string | null;
  /** Residual robust spread in angle bins (after removing the slope). */
  readonly residualByAngle: readonly {
    readonly from: number;
    readonly to: number;
    readonly n: number;
    readonly spread: number;
  }[];
}

const BINS: readonly [number, number][] = [
  [0, 10],
  [10, 20],
  [20, 30],
  [30, 90],
];

function medianOf(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function robust(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const med = s[Math.floor(s.length / 2)]!;
  const dev = s.map((x) => Math.abs(x - med)).sort((a, b) => a - b);
  return 1.4826 * dev[Math.floor(dev.length / 2)]!;
}

/** Within-player slope of each metric against |camera angle|. */
export function fitAngleTrends(
  attempts: readonly MeasuredAttempt[],
  cfg: TrendConfig = DEFAULT_TREND_CONFIG,
): Record<string, AngleTrend> {
  const ids = new Set(attempts.flatMap((a) => Object.keys(a.values)));
  const out: Record<string, AngleTrend> = {};
  for (const id of [...ids].sort()) {
    // Per player: (|angle|, value) pairs, centred on the player's means.
    const byPlayer = new Map<string, { x: number; y: number }[]>();
    for (const a of attempts) {
      const v = a.values[id];
      if (!v) continue;
      byPlayer.set(a.player, [
        ...(byPlayer.get(a.player) ?? []),
        { x: Math.abs(a.angle), y: v.value },
      ]);
    }
    const pts: { dx: number; dy: number; x: number; player: string }[] = [];
    let players = 0;
    for (const [player, xs] of byPlayer) {
      if (xs.length < 2) continue;
      players++;
      const mx = xs.reduce((s, p) => s + p.x, 0) / xs.length;
      const my = xs.reduce((s, p) => s + p.y, 0) / xs.length;
      for (const p of xs)
        pts.push({ dx: p.x - mx, dy: p.y - my, x: p.x, player });
    }
    const n = pts.length;
    const sxx = pts.reduce((s, p) => s + p.dx * p.dx, 0);
    const angleSpread = n > 1 ? Math.sqrt(sxx / (n - 1)) : 0;
    const slope = sxx > 0 ? pts.reduce((s, p) => s + p.dx * p.dy, 0) / sxx : 0;
    const dof = n - players - 1;
    const rss = pts.reduce((s, p) => s + (p.dy - slope * p.dx) ** 2, 0);
    const se = sxx > 0 && dof > 0 ? Math.sqrt(rss / dof / sxx) : Infinity;
    const reason = !cfg.enabled
      ? "disabled"
      : n < cfg.minAttempts
        ? `only ${n} attempts (need ${cfg.minAttempts})`
        : players < cfg.minPlayers
          ? `only ${players} players with 2+ attempts (need ${cfg.minPlayers})`
          : angleSpread < cfg.minAngleSpread
            ? `angles too similar (SD ${angleSpread.toFixed(1)}°)`
            : Math.abs(slope) < cfg.t * se
              ? "no clear trend"
              : null;
    // Residuals around each player's MEDIAN (a mean would be dragged by the
    // noisy oblique shots, smearing their noise into every bin).
    const detr = pts.map((p) => ({ ...p, r: p.dy - slope * p.dx }));
    const centre = new Map<string, number>();
    for (const player of new Set(detr.map((p) => p.player))) {
      const rs = detr.filter((p) => p.player === player).map((p) => p.r);
      centre.set(player, medianOf(rs));
    }
    const residuals = detr.map((p) => ({
      x: p.x,
      r: p.r - centre.get(p.player)!,
    }));
    out[id] = {
      id,
      slope,
      standardError: se,
      attempts: n,
      players,
      angleSpread,
      significant: reason === null,
      reason,
      residualByAngle: BINS.map(([from, to]) => {
        const rs = residuals
          .filter((p) => p.x >= from && p.x < to)
          .map((p) => p.r);
        return { from, to, n: rs.length, spread: robust(rs) };
      }),
    };
  }
  return out;
}

/** Attempts with significant trends removed (values brought to 0°). */
export function applyAngleTrends(
  attempts: readonly MeasuredAttempt[],
  trends: Readonly<Record<string, AngleTrend>>,
): MeasuredAttempt[] {
  return attempts.map((a) => {
    const values: Record<string, MeasuredAttempt["values"][string]> = {};
    for (const [id, v] of Object.entries(a.values)) {
      const t = trends[id];
      values[id] =
        t && t.significant
          ? { ...v, value: v.value - t.slope * Math.abs(a.angle) }
          : v;
    }
    return { ...a, values };
  });
}

/**
 * A suggested angle limit per metric: the widest bin whose residual spread
 * stays within `factor` × the near-side-on (0–10°) spread. Null without
 * enough near-side-on data.
 */
export function suggestedLimit(t: AngleTrend, factor = 1.5): number | null {
  const base = t.residualByAngle[0];
  if (!base || base.n < 5 || !(base.spread > 0)) return null;
  let limit = base.to;
  for (const b of t.residualByAngle.slice(1)) {
    if (b.n < 5) break;
    if (b.spread > factor * base.spread) break;
    limit = b.to;
  }
  return Math.min(limit, 30);
}
