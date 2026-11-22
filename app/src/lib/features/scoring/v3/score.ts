/**
 * v3 scoring: each metric on a 0–10+ scale where 0 = inside the reference band
 * (on target) and the score climbs 1 point per reference spread (`rampSd`)
 * beyond the band edge. The display caps at "10+"; the stored value doesn't.
 * Phase score = mean of its measured, scored metrics; overall = mean of the
 * phase scores. Metrics are kept in catalog (= shot) order within each phase.
 *
 * Feedback = the 3 worst metrics, re-ordered by phase, each with a measurement
 * phrase (card) and a coaching cue (voice), always named with its phase.
 *
 * Pure.
 */
import {
  DEFAULT_WORDING,
  effectiveBand,
  NEGLIGIBLE_SCORE,
  scoreValue,
  type LiveTargetsV3,
  type MetricPhase,
  type MetricUnit,
  type ShotMetricsV3,
} from "basketball-shot-analysis";
import {
  FEEDBACK_COUNT,
  PHASE_NAME,
  buildCueReadback,
  feedbackItems,
} from "$lib/features/live-practice/loop/readback";

export const PHASES_V3: readonly MetricPhase[] = [
  "load",
  "rise",
  "setPoint",
  "release",
];
/** Below this share of measurable scored metrics the overall is withheld. */
export const COVERAGE_GATE = 0.5;
/** Display cap. */
export const SCORE_CAP = 10;
/**
 * Excess smaller than this share of a reference spread counts as on target
 * (avoids "too far forward by 0%" rows scoring 0.0).
 */
export const NEGLIGIBLE = NEGLIGIBLE_SCORE;

export interface MetricResultV3 {
  readonly id: string;
  readonly phase: MetricPhase;
  readonly kind: "structure" | "timing" | "detail";
  readonly label: string;
  readonly unit: MetricUnit;
  /** Measured value (null = not measured). */
  readonly value: number | null;
  /** Why it wasn't measured / quality note ("low resolution"). */
  readonly note: string | null;
  readonly scored: boolean;
  /** 0 = on target; +1 per reference spread outside the band; null = n/a. */
  readonly score: number | null;
  readonly direction: "low" | "high" | null;
  /** Distance outside the band, native units (0 inside). */
  readonly magnitude: number;
  readonly passMin: number;
  readonly passMax: number;
  readonly ideal: number;
  /** Scorecard phrase ("too shallow") — null when on target. */
  readonly phrase: string | null;
  /** Coaching cue ("Bend your knees more") — null when on target. */
  readonly cue: string | null;
  /** Measurement frames (for review seeking). */
  readonly frames: readonly number[];
}

export interface PhaseResultV3 {
  readonly phase: MetricPhase;
  readonly name: string;
  readonly score: number | null;
  readonly metrics: readonly MetricResultV3[];
}

export interface ScorecardV3 {
  readonly overall: number | null;
  readonly phases: readonly PhaseResultV3[];
  /** Unscored details (shown, never scored). */
  readonly details: readonly MetricResultV3[];
  /** Off-target scored metrics, worst first. */
  readonly worst: readonly MetricResultV3[];
  readonly measuredFraction: number;
  readonly belowCoverageGate: boolean;
}

/** Catalog order (the wording table is written in shot order). */
const CATALOG_ORDER = Object.keys(DEFAULT_WORDING);
const orderOf = (id: string) => {
  const i = CATALOG_ORDER.indexOf(id);
  return i < 0 ? CATALOG_ORDER.length : i;
};

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export function scoreShotV3(
  metrics: ShotMetricsV3["metrics"],
  targets: LiveTargetsV3,
): ScorecardV3 {
  const results: MetricResultV3[] = [];
  for (const [id, t] of Object.entries(targets.metrics)) {
    const m = metrics[id];
    const band = effectiveBand(t);
    const measured = !!m && m.reliable && Number.isFinite(m.value);
    let score: number | null = null;
    let direction: "low" | "high" | null = null;
    let magnitude = 0;
    if (measured) {
      ({ score, direction, magnitude } = scoreValue(t, m!.value));
    }
    const words = direction ? t.wording[direction] : null;
    results.push({
      id,
      phase: t.phase,
      kind: t.kind,
      label: t.label,
      unit: t.unit,
      value: measured ? m!.value : null,
      note: m?.note ?? (m ? null : "not measured"),
      scored: band.scored,
      score: band.scored ? score : null,
      direction,
      magnitude,
      passMin: band.passMin,
      passMax: band.passMax,
      ideal: t.ideal,
      phrase: words?.phrase ?? null,
      cue: words?.cue ?? null,
      frames: m?.frames ?? [],
    });
  }
  results.sort((a, b) => orderOf(a.id) - orderOf(b.id));

  const phases = PHASES_V3.map((phase) => {
    const ms = results.filter((r) => r.phase === phase && r.kind !== "detail");
    return {
      phase,
      name: PHASE_NAME[phase] ?? phase,
      score: mean(ms.filter((r) => r.score !== null).map((r) => r.score!)),
      metrics: ms,
    };
  });
  const scoredAll = results.filter((r) => r.scored);
  const measuredFraction = scoredAll.length
    ? scoredAll.filter((r) => r.score !== null).length / scoredAll.length
    : 0;
  const belowCoverageGate = measuredFraction < COVERAGE_GATE;
  const phaseScores = phases
    .filter((p) => p.score !== null)
    .map((p) => p.score!);
  return {
    overall: belowCoverageGate ? null : mean(phaseScores),
    phases,
    details: results.filter((r) => r.kind === "detail"),
    worst: results
      .filter((r) => r.score !== null && r.score > 0)
      .sort((a, b) => b.score! - a.score!),
    measuredFraction,
    belowCoverageGate,
  };
}

// ---- display ------------------------------------------------------------------

/**
 * Whole-number display score: rounded UP, so anything off target shows at
 * least 1 and only a truly on-target value shows 0 (2.1 → 3). Capped at
 * "10+". The stored score keeps its decimals.
 */
export function wholeScore(score: number): number {
  return Math.min(SCORE_CAP, Math.ceil(score - 1e-9));
}

/** "0" … "9", "10+" (never shows more than the cap). */
export function displayScore(score: number | null): string {
  if (score === null) return "–";
  const w = wholeScore(score);
  return w >= SCORE_CAP ? "10+" : String(w);
}

export type ScoreBand = "good" | "fair" | "off" | "far";
/** On the shown whole numbers: 0 good · 1–3 close · 4–6 off · 7–10+ way off. */
export function scoreBand(score: number | null): ScoreBand | null {
  if (score === null) return null;
  const w = wholeScore(score);
  if (w <= 0) return "good";
  if (w <= 3) return "fair";
  if (w <= 6) return "off";
  return "far";
}

/**
 * Short issue text for the practice card and review chips: what's off and
 * how far, on the score scale ("Head position: tilted back by 2"). Measured
 * amounts (degrees, % of a limb) stay in the full scorecard.
 */
export function issueText(r: MetricResultV3): string {
  if (r.value === null) return `${r.label}: not measured`;
  if (!r.direction || r.score === null) return `${r.label}: on target`;
  return `${r.label}: ${r.phrase} by ${displayScore(r.score)}`;
}

const UNIT_NAME: Partial<Record<MetricUnit, string>> = {
  torso: "torso length",
  thigh: "thigh length",
  shin: "shin length",
  forearm: "forearm length",
  leg: "leg length",
};

/** An amount in the metric's unit, for people: "12°", "8% of your torso length". */
export function formatAmount(
  unit: MetricUnit,
  amount: number,
  phase: MetricPhase,
): string {
  const a = Math.abs(amount);
  switch (unit) {
    case "deg":
      return `${Math.round(a)}°`;
    case "s":
      return `${a.toFixed(2)} s`;
    case "phase":
      return `${Math.round(a * 100)}% of the ${(PHASE_NAME[phase] ?? phase).toLowerCase()}`;
    default:
      return `${Math.round(a * 100)}% of your ${UNIT_NAME[unit] ?? unit}`;
  }
}

/** "Knee bend: too shallow by 12°" — or "Knee bend: on target". */
export function describeResult(r: MetricResultV3): string {
  if (r.value === null) return `${r.label}: not measured`;
  if (!r.direction) return `${r.label}: on target`;
  return `${r.label}: ${r.phrase} by ${formatAmount(r.unit, r.magnitude, r.phase)}`;
}

/** "target 126–140°" in the metric's unit (signed for offsets/timing). */
export function targetText(r: MetricResultV3): string {
  const f = (v: number) => {
    if (r.unit === "deg") return `${Math.round(v)}`;
    if (r.unit === "s") return v.toFixed(2);
    return `${Math.round(v * 100)}`;
  };
  const suffix =
    r.unit === "deg"
      ? "°"
      : r.unit === "s"
        ? " s"
        : r.unit === "phase"
          ? "% of phase"
          : `% ${UNIT_NAME[r.unit] ?? r.unit}`;
  return `target ${f(r.passMin)} to ${f(r.passMax)}${suffix}`;
}

// ---- feedback -------------------------------------------------------------------

export interface FeedbackV3 {
  /** The worst metrics fed back, in phase order. */
  readonly items: readonly MetricResultV3[];
  /** Spoken line: cues grouped by phase, e.g. "Load: Bend your knees more." */
  readonly spoken: string;
}

export function feedbackV3(
  card: ScorecardV3,
  opts: { max?: number; focus?: (id: string) => boolean } = {},
): FeedbackV3 {
  const pool = opts.focus
    ? card.worst.filter((r) => opts.focus!(r.id))
    : card.worst;
  const items = feedbackItems(pool, opts.max ?? FEEDBACK_COUNT);
  const spoken = buildCueReadback(items);
  return { items, spoken };
}
