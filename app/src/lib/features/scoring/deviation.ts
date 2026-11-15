/**
 * Deviation scoring (live-first redesign — Milestone 1, step 2).
 *
 * The SwingCoach-style scorecard for a single live shot: each metric is scored
 * by how far it deviates from the pro band in `live-targets.json`, on a **1..10
 * scale where lower is better** (1 = inside the pro band; it climbs toward 10 as
 * the value drifts further out). Metrics roll up into two top-level sections —
 * **Structure** and **Sequencing** — each grouped by shot phase, with a group
 * score, a section score, and an overall shot score. A `worst` list surfaces the
 * off-target metrics (direction + magnitude in native units) that drive the
 * per-shot voice readback ("set point low by 2").
 *
 * Pure: no DB / network / Svelte. Input is the flat metric list from the library
 * (`flattenMetrics`) plus the loaded targets; output is a plain scorecard.
 *
 * @see docs/live-redesign-plan.md §3.2
 */

import {
  flattenMetrics,
  type FlatMetric,
  type ShotMetricsV2,
} from "basketball-shot-analysis";

// ============================================================================
// Target shape (live-targets.json)
// ============================================================================

export interface LiveTarget {
  readonly section: "structure" | "sequencing";
  /** Phase for structure metrics; null for sequencing (grouped at runtime). */
  readonly phase: string | null;
  readonly label: string;
  readonly unit: string;
  /** The on-target value (mean of the approved reference shots). */
  readonly ideal: number;
  readonly sd: number;
  /** Inclusive pass band — a value inside it scores a perfect 1. */
  readonly passMin: number;
  readonly passMax: number;
  /** Native units per deviation step for the 1..10 ramp (never 0). */
  readonly rampSd: number;
  readonly direction: { readonly low: string; readonly high: string };
  /** False for reported-only metrics (excluded from aggregates + worst). */
  readonly scored: boolean;
}

export interface LiveTargets {
  readonly version: number;
  readonly builtFrom?: string;
  readonly shootingHand?: "left" | "right";
  readonly metrics: Readonly<Record<string, LiveTarget>>;
}

// ============================================================================
// Scorecard shape
// ============================================================================

export type Section = "structure" | "sequencing";

export interface MetricDeviation {
  readonly id: string;
  readonly label: string;
  readonly section: Section;
  /** Grouping phase (one of the 6 phases, or a fallback for stray ids). */
  readonly phase: string;
  readonly value: number;
  readonly ideal: number;
  readonly passMin: number;
  readonly passMax: number;
  readonly unit: string;
  /** 1..10, lower is better. 1 when inside the pass band. */
  readonly score: number;
  /** |value − ideal| / rampSd — cross-metric comparable, ranks `worst`. */
  readonly normDev: number;
  readonly inBand: boolean;
  /** Direction word when off-target ("low"/"high"/"early"/"late"); null in-band. */
  readonly direction: string | null;
  /** Distance outside the band in native units (0 when in-band). */
  readonly magnitude: number;
  /** Whether this metric contributes to group/section/overall scores + worst. */
  readonly scored: boolean;
}

export interface PhaseGroup {
  readonly phase: string;
  readonly label: string;
  /** Mean of the group's scored metrics; null when none are scored. */
  readonly score: number | null;
  readonly metrics: readonly MetricDeviation[];
}

export interface SectionDeviation {
  readonly section: Section;
  readonly label: string;
  readonly score: number | null;
  readonly phases: readonly PhaseGroup[];
}

export interface ShotScorecard {
  /** Mean of the available section scores; null when nothing was scored. */
  readonly overall: number | null;
  readonly sections: readonly SectionDeviation[];
  /** Off-target scored metrics, worst-first, capped at `maxWorst`. */
  readonly worst: readonly MetricDeviation[];
  /** Every metric that had a target + a reading, in stable order. */
  readonly all: readonly MetricDeviation[];
  /** Scored targets that got a reliable reading this shot. */
  readonly measuredCount: number;
  /** Total scored targets in the target set. */
  readonly scoredTargetCount: number;
  readonly measuredFraction: number;
  /** True when coverage is too low to trust the headline (follow-up §2.5). */
  readonly belowCoverageGate: boolean;
  readonly targetsVersion: number;
}

export interface DeviationOptions {
  /** Max entries in `worst`. Default 5. */
  readonly maxWorst?: number;
  /** measuredFraction below this flags `belowCoverageGate`. Default 0.5. */
  readonly coverageGate?: number;
}

// ============================================================================
// Grouping metadata
// ============================================================================

const SECTION_ORDER: readonly Section[] = ["structure", "sequencing"];
const PHASE_ORDER: readonly string[] = [
  "gather",
  "load",
  "rise",
  "setPoint",
  "release",
  "followThrough",
];
const PHASE_LABELS: Record<string, string> = {
  gather: "Gather",
  load: "Load",
  rise: "Rise",
  setPoint: "Set Point",
  release: "Release",
  followThrough: "Follow-through",
  sequencing: "Sequencing",
  other: "Other",
};
const SECTION_LABELS: Record<Section, string> = {
  structure: "Structure",
  sequencing: "Sequencing",
};

/**
 * Phase a sequencing gap is grouped under — the phase of its `from` event,
 * mapped through the keyframe→phase breakdown (see testing/types.ts). A gap
 * `seq.<from>__<to>` is anchored at `from`.
 */
const SEQ_EVENT_PHASE: Record<string, string> = {
  ball_low: "load",
  leg_low: "load",
  ball_rise: "rise",
  legs_rise: "rise",
  set_point: "setPoint",
  legs_extend: "release",
  release: "release",
  arm_extension: "release",
};

function groupingPhase(id: string, target: LiveTarget): string {
  if (target.phase) return target.phase;
  if (id.startsWith("seq.")) {
    const from = id.slice(4).split("__")[0] ?? "";
    return SEQ_EVENT_PHASE[from] ?? "sequencing";
  }
  return "other";
}

function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase] ?? phase;
}

// ============================================================================
// Numeric helpers
// ============================================================================

const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));
const round = (x: number, places: number): number => {
  const f = 10 ** places;
  return Math.round(x * f) / f;
};
function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ============================================================================
// Per-metric scoring
// ============================================================================

/**
 * Scores one measured metric against its target. `value` is assumed finite and
 * reliable (callers filter unreliable readings out before calling).
 */
export function scoreMetricDeviation(
  id: string,
  value: number,
  target: LiveTarget,
): MetricDeviation {
  const ramp = target.rampSd > 0 ? target.rampSd : 1;
  const normDev = Math.abs(value - target.ideal) / ramp;
  const inBand = value >= target.passMin && value <= target.passMax;

  let direction: string | null = null;
  let magnitude = 0;
  if (!inBand) {
    if (value < target.passMin) {
      direction = target.direction.low;
      magnitude = target.passMin - value;
    } else {
      direction = target.direction.high;
      magnitude = value - target.passMax;
    }
  }

  const score = inBand ? 1 : clamp(1 + normDev, 1, 10);

  return {
    id,
    label: target.label,
    section: target.section,
    phase: groupingPhase(id, target),
    value: round(value, 4),
    ideal: round(target.ideal, 4),
    passMin: round(target.passMin, 4),
    passMax: round(target.passMax, 4),
    unit: target.unit,
    score: round(score, 1),
    normDev: round(normDev, 3),
    inBand,
    direction,
    magnitude: round(magnitude, 3),
    scored: target.scored,
  };
}

// ============================================================================
// Shot scoring
// ============================================================================

/**
 * Scores a shot's flat metrics against the targets and builds the full
 * scorecard: per-metric deviations, Structure/Sequencing sections grouped by
 * phase, the worst off-target metrics, and coverage.
 */
export function scoreDeviation(
  metrics: readonly FlatMetric[],
  targets: LiveTargets,
  options: DeviationOptions = {},
): ShotScorecard {
  const maxWorst = options.maxWorst ?? 5;
  const coverageGate = options.coverageGate ?? 0.5;

  // Score every measured, reliable metric that has a target.
  const all: MetricDeviation[] = [];
  const measuredIds = new Set<string>();
  for (const m of metrics) {
    if (!m.reliable || !Number.isFinite(m.value)) continue;
    const target = targets.metrics[m.id];
    if (!target) continue; // measured but no target → not comparable
    all.push(scoreMetricDeviation(m.id, m.value, target));
    measuredIds.add(m.id);
  }

  // Stable order: section, then phase order, then id.
  const sectionRank = (s: Section): number => SECTION_ORDER.indexOf(s);
  const phaseRank = (p: string): number => {
    const i = PHASE_ORDER.indexOf(p);
    return i === -1 ? PHASE_ORDER.length : i;
  };
  all.sort(
    (a, b) =>
      sectionRank(a.section) - sectionRank(b.section) ||
      phaseRank(a.phase) - phaseRank(b.phase) ||
      a.id.localeCompare(b.id),
  );

  // Roll up into sections → phase groups.
  const sections: SectionDeviation[] = SECTION_ORDER.map((section) => {
    const inSection = all.filter((m) => m.section === section);
    const phases: PhaseGroup[] = [];
    const seen = new Set<string>();
    for (const m of inSection) {
      if (seen.has(m.phase)) continue;
      seen.add(m.phase);
      const groupMetrics = inSection.filter((x) => x.phase === m.phase);
      const scoredScores = groupMetrics
        .filter((x) => x.scored)
        .map((x) => x.score);
      const gScore = mean(scoredScores);
      phases.push({
        phase: m.phase,
        label: phaseLabel(m.phase),
        score: gScore === null ? null : round(gScore, 1),
        metrics: groupMetrics,
      });
    }
    const sScores = inSection.filter((m) => m.scored).map((m) => m.score);
    const sScore = mean(sScores);
    return {
      section,
      label: SECTION_LABELS[section],
      score: sScore === null ? null : round(sScore, 1),
      phases,
    };
  });

  // Overall = mean of the sections that have a score (equal weight to each).
  const sectionScores = sections
    .map((s) => s.score)
    .filter((s): s is number => s !== null);
  const overall = sectionScores.length ? round(mean(sectionScores)!, 1) : null;

  // Worst = off-target scored metrics, highest normDev first.
  const worst = all
    .filter((m) => m.scored && !m.inBand)
    .sort((a, b) => b.normDev - a.normDev)
    .slice(0, maxWorst);

  // Coverage over scored targets.
  const scoredTargetIds = Object.entries(targets.metrics)
    .filter(([, t]) => t.scored)
    .map(([id]) => id);
  const scoredTargetCount = scoredTargetIds.length;
  const measuredCount = scoredTargetIds.filter((id) =>
    measuredIds.has(id),
  ).length;
  const measuredFraction =
    scoredTargetCount > 0 ? measuredCount / scoredTargetCount : 0;

  return {
    overall,
    sections,
    worst,
    all,
    measuredCount,
    scoredTargetCount,
    measuredFraction: round(measuredFraction, 3),
    belowCoverageGate: measuredFraction < coverageGate,
    targetsVersion: targets.version,
  };
}

/** Convenience: flatten a library `ShotMetricsV2` and score it. */
export function scoreShotDeviation(
  shot: ShotMetricsV2,
  targets: LiveTargets,
  options: DeviationOptions = {},
): ShotScorecard {
  return scoreDeviation(flattenMetrics(shot), targets, options);
}
