/**
 * Targets from reviewed pro attempts (docs/pro-targets-plan.md, Phase 3).
 *
 *  1. Per attempt: metric values measured from the labelled key frames with
 *     the confirmed camera angle corrected for (`measureAttempt`), dropping
 *     metrics flagged by the reviewer or beyond their camera-angle limit.
 *  2. Per player: each metric's value = the weighted mean of their attempts
 *     (weight cos²(angle): near-side-on shots count more), spread = robust SD.
 *  3. Pooled: every player counts equally (their shots' weights sum to 1).
 *     Band = the configured percentiles of pooled pro shots (default 20th–
 *     80th), so pros don't all score 0; ideal = weighted median; the score
 *     step (`rampSd`) = the pooled robust spread.
 *  4. Style: when players disagree far more than any one varies (between-
 *     player spread > `styleRatio` × the median within-player spread), the
 *     metric is style, not fundamentals — unscored by default.
 *
 * Pure; the node script (src/testing/build-pro-targets.ts) does the I/O.
 */
import {
  LIVE_TARGETS_V3_VERSION,
  MIN_REFERENCE_VALUES,
  scoreValue,
  wordingFor,
  type LiveTargetsV3,
  type MetricKind,
  type MetricPhase,
  type MetricUnit,
  type TargetV3,
} from "../metrics/v3";
import {
  DEFAULT_TREND_CONFIG,
  applyAngleTrends,
  fitAngleTrends,
  suggestedLimit,
  type AngleTrend,
  type TrendConfig,
} from "./angle-trend";

export interface BuildConfig {
  /** Band percentiles per metric (default for all, then overrides). */
  readonly percentiles: {
    readonly default: readonly [number, number];
    readonly byMetric?: Readonly<Record<string, readonly [number, number]>>;
  };
  /** A player needs this many usable attempts to count. */
  readonly minShotsPerPlayer: number;
  /** Between / within player spread above which a metric is "style". */
  readonly styleRatio: number;
  /** Whether style metrics are still scored. */
  readonly styleScored: boolean;
  /** Use `flagged` attempts too (approved only by default). */
  readonly includeFlagged: boolean;
  /** Per-metric camera-angle limits (deg), overriding the defaults. */
  readonly angleLimits: Readonly<Record<string, number>>;
  /** Leftover angle error: fitted and removed when the data shows it. */
  readonly angleTrend: TrendConfig;
}

export const DEFAULT_BUILD_CONFIG: BuildConfig = {
  percentiles: { default: [0.2, 0.8] },
  minShotsPerPlayer: 5,
  styleRatio: 2,
  styleScored: false,
  includeFlagged: false,
  angleLimits: {},
  angleTrend: DEFAULT_TREND_CONFIG,
};

/** Merges a (partial) config file over the defaults. */
export function buildConfig(raw: unknown): BuildConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<BuildConfig>;
  return {
    ...DEFAULT_BUILD_CONFIG,
    ...r,
    percentiles: {
      ...DEFAULT_BUILD_CONFIG.percentiles,
      ...(r.percentiles ?? {}),
    },
    angleLimits: { ...(r.angleLimits ?? {}) },
    angleTrend: { ...DEFAULT_TREND_CONFIG, ...(r.angleTrend ?? {}) },
  };
}

/** One usable metric value from one attempt. */
export interface AttemptValue {
  readonly value: number;
  readonly phase: MetricPhase;
  readonly kind: MetricKind;
  readonly unit: MetricUnit;
  readonly lowResolution: boolean;
}

/** One reviewed attempt, measured (values already limited / unflagged). */
export interface MeasuredAttempt {
  readonly player: string;
  readonly clip: string;
  readonly shotNumber: number;
  /** Camera angle used (deg off side-on). */
  readonly angle: number;
  readonly values: Readonly<Record<string, AttemptValue>>;
}

export interface PlayerMetric {
  readonly value: number;
  readonly spread: number;
  readonly n: number;
}

export interface ProProfile {
  readonly id: string;
  readonly name: string;
  readonly shootingHand: "left" | "right";
  readonly shots: number;
  /** [min, max] camera angle of the attempts used. */
  readonly angles: readonly [number, number];
  readonly metrics: Readonly<Record<string, PlayerMetric>>;
}

export interface ProProfiles {
  readonly version: 1;
  readonly builtAt: string;
  readonly metricsSchema: number;
  readonly pros: readonly ProProfile[];
}

// ---- weighted statistics ------------------------------------------------------

interface W {
  readonly v: number;
  readonly w: number;
}

/** Weighted quantile (linear between sorted points by cumulative weight). */
export function weightedQuantile(xs: readonly W[], q: number): number {
  const s = [...xs].filter((x) => x.w > 0).sort((a, b) => a.v - b.v);
  if (s.length === 0) return NaN;
  if (s.length === 1) return s[0]!.v;
  const total = s.reduce((a, x) => a + x.w, 0);
  // Positions at the middle of each point's weight (Hazen-style).
  let acc = 0;
  const pos = s.map((x) => {
    const p = (acc + x.w / 2) / total;
    acc += x.w;
    return p;
  });
  if (q <= pos[0]!) return s[0]!.v;
  if (q >= pos.at(-1)!) return s.at(-1)!.v;
  for (let i = 1; i < s.length; i++) {
    if (q <= pos[i]!) {
      const t = (q - pos[i - 1]!) / (pos[i]! - pos[i - 1]!);
      return s[i - 1]!.v + t * (s[i]!.v - s[i - 1]!.v);
    }
  }
  return s.at(-1)!.v;
}

/** Robust SD: 1.4826 × weighted median absolute deviation (SD fallback). */
export function robustSpread(xs: readonly W[]): number {
  if (xs.length < 2) return 0;
  const med = weightedQuantile(xs, 0.5);
  const mad =
    1.4826 *
    weightedQuantile(
      xs.map((x) => ({ v: Math.abs(x.v - med), w: x.w })),
      0.5,
    );
  if (mad > 0) return mad;
  const tw = xs.reduce((a, x) => a + x.w, 0);
  const mean = xs.reduce((a, x) => a + x.v * x.w, 0) / tw;
  return Math.sqrt(xs.reduce((a, x) => a + x.w * (x.v - mean) ** 2, 0) / tw);
}

/** cos²(angle): near-side-on shots count more. */
export const angleWeight = (deg: number) =>
  Math.cos((Math.min(89, Math.abs(deg)) * Math.PI) / 180) ** 2;

// ---- build ---------------------------------------------------------------------

export interface BuildInput {
  readonly attempts: readonly MeasuredAttempt[];
  readonly players: Readonly<
    Record<string, { name: string; shootingHand: "left" | "right" }>
  >;
  readonly config: BuildConfig;
  readonly previous?: Pick<LiveTargetsV3, "metrics"> | null;
  readonly generatedAt?: string;
  readonly metricsSchema: number;
}

export interface MetricReport {
  readonly id: string;
  readonly players: number;
  readonly shots: number;
  readonly scored: boolean;
  readonly style: boolean;
  /** Between-player / median within-player spread (null: < 3 players). */
  readonly styleRatio: number | null;
  /** Share of pro shots scoring 0 against the new targets. */
  readonly zeroShare: number;
  /** Mean whole-number score of pro shots. */
  readonly meanScore: number;
}

export interface BuildResult {
  readonly targets: LiveTargetsV3;
  readonly profiles: ProProfiles;
  readonly report: readonly MetricReport[];
  /** Players left out (too few usable attempts). */
  readonly droppedPlayers: readonly { id: string; shots: number }[];
  /** Leftover camera-angle trends per metric (applied where significant). */
  readonly angleTrends: Readonly<Record<string, AngleTrend>>;
}

export function buildProTargets(input: BuildInput): BuildResult {
  const { config: cfg } = input;
  // Players with enough attempts.
  const byPlayer = new Map<string, MeasuredAttempt[]>();
  for (const a of input.attempts) {
    byPlayer.set(a.player, [...(byPlayer.get(a.player) ?? []), a]);
  }
  const droppedPlayers: { id: string; shots: number }[] = [];
  for (const [p, as] of byPlayer) {
    if (as.length < cfg.minShotsPerPlayer) {
      droppedPlayers.push({ id: p, shots: as.length });
      byPlayer.delete(p);
    }
  }
  // Leftover camera-angle error: fit within players, bring values to 0°.
  const trends = fitAngleTrends([...byPlayer.values()].flat(), cfg.angleTrend);
  for (const [p, as] of byPlayer) byPlayer.set(p, applyAngleTrends(as, trends));

  // Per-player profiles.
  const ids = new Set<string>();
  for (const as of byPlayer.values())
    for (const a of as) for (const id of Object.keys(a.values)) ids.add(id);
  const meta = new Map<string, AttemptValue>();
  const pros: ProProfile[] = [];
  for (const [p, as] of [...byPlayer].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const metrics: Record<string, PlayerMetric> = {};
    for (const id of ids) {
      const xs = as
        .filter((a) => a.values[id])
        .map((a) => {
          meta.set(id, meta.get(id) ?? a.values[id]!);
          return { v: a.values[id]!.value, w: angleWeight(a.angle) };
        });
      if (xs.length === 0) continue;
      const tw = xs.reduce((s, x) => s + x.w, 0);
      metrics[id] = {
        value: xs.reduce((s, x) => s + x.v * x.w, 0) / tw,
        spread: robustSpread(xs),
        n: xs.length,
      };
    }
    const angles = as.map((a) => a.angle);
    pros.push({
      id: p,
      name: input.players[p]?.name ?? p,
      shootingHand: input.players[p]?.shootingHand ?? "right",
      shots: as.length,
      angles: [Math.min(...angles), Math.max(...angles)],
      metrics,
    });
  }

  // Pooled targets.
  const targets: Record<string, TargetV3> = {};
  const report: MetricReport[] = [];
  for (const id of [...ids].sort()) {
    const m = meta.get(id)!;
    const pooled: W[] = [];
    let lowRes = false;
    for (const as of byPlayer.values()) {
      const xs = as.filter((a) => a.values[id]);
      const tw = xs.reduce((s, a) => s + angleWeight(a.angle), 0);
      for (const a of xs) {
        pooled.push({ v: a.values[id]!.value, w: angleWeight(a.angle) / tw });
        lowRes ||= a.values[id]!.lowResolution;
      }
    }
    const playersWith = pros.filter((p) => p.metrics[id]);
    const [qLo, qHi] =
      cfg.percentiles.byMetric?.[id] ?? cfg.percentiles.default;
    const passMin = weightedQuantile(pooled, qLo);
    const passMax = weightedQuantile(pooled, qHi);
    const ideal = weightedQuantile(pooled, 0.5);
    const spread = robustSpread(pooled);
    const tw = pooled.reduce((s, x) => s + x.w, 0);
    const mean = pooled.reduce((s, x) => s + x.v * x.w, 0) / tw;
    const sd = Math.sqrt(
      pooled.reduce((s, x) => s + x.w * (x.v - mean) ** 2, 0) / tw,
    );
    // Style: players disagree much more than any one of them varies.
    let ratio: number | null = null;
    if (playersWith.length >= 3) {
      const between = robustSpread(
        playersWith.map((p) => ({ v: p.metrics[id]!.value, w: 1 })),
      );
      const within = weightedQuantile(
        playersWith.map((p) => ({ v: p.metrics[id]!.spread, w: 1 })),
        0.5,
      );
      ratio = within > 0 ? between / within : null;
    }
    const style = ratio !== null && ratio > cfg.styleRatio;
    const prev = input.previous?.metrics[id];
    const def = wordingFor(id);
    const scored =
      m.kind !== "detail" &&
      pooled.length >= MIN_REFERENCE_VALUES &&
      (!style || cfg.styleScored);
    const rampSd =
      spread > 0
        ? spread
        : passMax > passMin
          ? (passMax - passMin) / 4
          : Math.max(1e-6, Math.abs(ideal) * 0.05);
    const t: TargetV3 = {
      phase: m.phase,
      kind: m.kind,
      unit: m.unit,
      label: prev?.label ?? def.label,
      wording: prev?.wording ?? { low: def.low, high: def.high },
      scored,
      ideal,
      sd,
      passMin,
      passMax,
      rampSd,
      n: pooled.length,
      lowResolution: lowRes,
      players: playersWith.length,
      style,
      ...(prev?.override ? { override: prev.override } : {}),
    };
    targets[id] = t;
    // Calibration: how pro shots score against these targets.
    const scores = pooled.map((x) => ({
      s: Math.min(10, Math.ceil(scoreValue(t, x.v).score - 1e-9)),
      w: x.w,
    }));
    const sw = scores.reduce((s, x) => s + x.w, 0) || 1;
    report.push({
      id,
      players: playersWith.length,
      shots: pooled.length,
      scored,
      style,
      styleRatio: ratio,
      zeroShare:
        scores.filter((x) => x.s === 0).reduce((s, x) => s + x.w, 0) / sw,
      meanScore: scores.reduce((s, x) => s + x.s * x.w, 0) / sw,
    });
  }

  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const shots = [...byPlayer.values()].reduce((n, as) => n + as.length, 0);
  return {
    targets: {
      version: LIVE_TARGETS_V3_VERSION,
      catalog: "v3",
      builtFrom: `reference-data: ${pros.length} pro(s), ${shots} reviewed shots`,
      shootingHand: "right",
      shots,
      generatedAt,
      notes: [
        `Band = the ${pct(cfg.percentiles.default[0])}–${pct(cfg.percentiles.default[1])} percentile of pooled pro shots (each pro weighted equally; near-side-on shots count more): pros can score above 0.`,
        "Outside, the score climbs 1 point per rampSd (the pooled robust spread). Display caps at 10+.",
        "Values come from reviewed attempts: labelled key frames, camera angle corrected; metrics flagged or beyond their camera-angle limit are left out.",
        "style = pros disagree far more than any one varies; unscored unless the build config says otherwise.",
        "Hand-edit label / wording / override freely; rebuilds keep them.",
      ],
      metrics: targets,
    },
    profiles: {
      version: 1,
      builtAt: generatedAt,
      metricsSchema: input.metricsSchema,
      pros,
    },
    report,
    droppedPlayers,
    angleTrends: trends,
  };
}

const pct = (q: number) => `${Math.round(q * 100)}th`;

function trendSection(trends: Readonly<Record<string, AngleTrend>>): string[] {
  const ts = Object.values(trends);
  if (ts.length === 0) return [];
  const timingBug = ts.filter((t) => t.significant && /\.t_/.test(t.id));
  const bins = ts[0]!.residualByAngle.map((b) => `${b.from}–${b.to}°`);
  return [
    `## Leftover camera-angle error`,
    "",
    "Each metric's drift with the camera angle after the 1/cos correction, fitted within players (form doesn't depend on the camera, so a drift is measurement error). Significant slopes are removed: every value is brought to its 0° equivalent before the targets are built.",
    "",
    ...(timingBug.length
      ? [
          `**Check:** timing metrics shouldn't drift with the angle, but these do: ${timingBug.map((t) => t.id).join(", ")}.`,
          "",
        ]
      : []),
    `| Metric | Slope / 10° | ± | Applied | Residual spread ${bins.join(" / ")} | Suggested limit |`,
    "|---|---|---|---|---|---|",
    ...ts.map(
      (t) =>
        `| ${t.id} | ${(t.slope * 10).toFixed(3)} | ${Number.isFinite(t.standardError) ? (t.standardError * 10).toFixed(3) : "–"} | ${t.significant ? "yes" : `no (${t.reason})`} | ${t.residualByAngle.map((b) => (b.n ? `${b.spread.toFixed(2)} (${b.n})` : "–")).join(" / ")} | ${suggestedLimit(t) ?? "–"}${suggestedLimit(t) !== null ? "°" : ""} |`,
    ),
    "",
  ];
}

/** The calibration report as Markdown. */
export function reportMarkdown(
  r: BuildResult,
  extra: {
    attempts: {
      used: number;
      dropped: readonly { where: string; why: string }[];
    };
    detection: readonly {
      event: string;
      n: number;
      median: number;
      p90: number;
    }[];
    /** Metric id → values left out for the camera angle. */
    overLimit?: readonly (readonly [string, number])[];
  },
): string {
  const lines: string[] = [
    `# Pro targets report`,
    "",
    `${r.targets.builtFrom} · built ${r.targets.generatedAt}`,
    "",
    `## Pros`,
    "",
    "| Pro | Shots | Camera angles |",
    "|---|---|---|",
    ...r.profiles.pros.map(
      (p) =>
        `| ${p.name} | ${p.shots} | ${p.angles[0].toFixed(0)}–${p.angles[1].toFixed(0)}° |`,
    ),
    ...(r.droppedPlayers.length
      ? [
          "",
          `Left out (too few usable attempts): ${r.droppedPlayers.map((d) => `${d.id} (${d.shots})`).join(", ")}`,
        ]
      : []),
    "",
    `## Metrics: how pro shots score`,
    ...(r.report.length === 0
      ? [
          "",
          "**No metric has usable values.** Every value was left out — most likely the approved attempts are filmed too far off side-on (see below).",
        ]
      : []),
    "",
    "Aim for most pro shots near 0 on fundamentals, without every pro scoring a perfect 0.",
    "",
    "| Metric | Pros | Shots | Scored | Pro shots at 0 | Mean pro score | Style ratio |",
    "|---|---|---|---|---|---|---|",
    ...r.report.map(
      (m) =>
        `| ${m.id} | ${m.players} | ${m.shots} | ${m.scored ? "yes" : m.style ? "no (style)" : "no"} | ${(m.zeroShare * 100).toFixed(0)}% | ${m.meanScore.toFixed(1)} | ${m.styleRatio === null ? "–" : m.styleRatio.toFixed(1)} |`,
    ),
    "",
    ...(extra.overLimit && extra.overLimit.length
      ? [
          `## Left out for the camera angle`,
          "",
          "Values beyond the metric's camera-angle limit (25° in-plane / timing, 15° arm and head, guide hand never).",
          "",
          "| Metric | Values left out |",
          "|---|---|",
          ...extra.overLimit.map(([id, n]) => `| ${id} | ${n} |`),
          "",
        ]
      : []),
    ...trendSection(r.angleTrends),
    `## App detection vs labelled key frames`,
    "",
    "Users are measured with detection, so large errors here need fixing in detection before the targets are trusted.",
    "",
    "| Event | Labelled | Median error (frames) | 90th percentile |",
    "|---|---|---|---|",
    ...extra.detection.map(
      (d) =>
        `| ${d.event} | ${d.n} | ${d.median.toFixed(1)} | ${d.p90.toFixed(1)} |`,
    ),
    "",
    `## Attempts`,
    "",
    `${extra.attempts.used} used.`,
    ...(extra.attempts.dropped.length
      ? ["", ...extra.attempts.dropped.map((d) => `- ${d.where}: ${d.why}`)]
      : []),
    "",
  ];
  return lines.join("\n");
}
