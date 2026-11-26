/**
 * Targets for the keyframe checks (`app/static/reference/live-targets-keyframes.json`),
 * built from reference shots exactly like the v3 targets: per check the mean
 * (`ideal`), the observed band (`passMin`..`passMax` — a reference value is on
 * target by definition) and a spread (`rampSd`) that sets how fast the score
 * climbs outside the band. Scoring is the shared v3 rule (`scoreValue`).
 *
 * Differences from v3:
 *  - wording lives in the catalog (./catalog), not in the targets file;
 *  - the spread has a floor per unit (`MIN_RAMP`), so a check every reference
 *    shot does identically (e.g. no hold at set point) doesn't turn a tiny
 *    difference into a 10+.
 *
 * Hand-set `override`s (band / scored) survive rebuilds.
 *
 * Pure.
 */
import {
  MIN_REFERENCE_VALUES,
  rampScale,
  scoreValue,
  effectiveBand,
  type TargetOverride,
} from "../v3/targets";
import {
  CHECK_DEFS,
  parseCheckKey,
  type CheckId,
  type CheckUnit,
  type Keyframe,
} from "./catalog";
import type { ShotKeyframes } from "./measure";

export const KEYFRAME_TARGETS_VERSION = 1 as const;

/** Smallest spread per unit: about one "can't tell the difference" step. */
export const MIN_RAMP: Readonly<Record<CheckUnit, number>> = {
  deg: 3,
  torso: 0.03,
  thigh: 0.04,
  s: 0.05,
};

export interface KeyframeTarget {
  readonly keyframe: Keyframe;
  readonly check: CheckId;
  readonly unit: CheckUnit;
  readonly scored: boolean;
  readonly ideal: number;
  readonly sd: number;
  readonly passMin: number;
  readonly passMax: number;
  readonly rampSd: number;
  /** Reference values the stats came from. */
  readonly n: number;
  /** Hand-set band / scored flag; wins over the computed values. */
  readonly override?: TargetOverride;
}

export interface KeyframeTargets {
  readonly version: typeof KEYFRAME_TARGETS_VERSION;
  readonly catalog: "keyframes";
  readonly builtFrom: string;
  readonly shootingHand: "left" | "right";
  readonly shots: number;
  readonly generatedAt: string;
  readonly notes: readonly string[];
  /** Targets by check id (`<keyframe>.<check>`). */
  readonly checks: Readonly<Record<string, KeyframeTarget>>;
}

export function buildKeyframeTargets(
  shots: readonly ShotKeyframes[],
  meta: {
    builtFrom: string;
    shootingHand: "left" | "right";
    generatedAt?: string;
  },
  previous?: Pick<KeyframeTargets, "checks"> | null,
): KeyframeTargets {
  const ids = new Set(shots.flatMap((s) => Object.keys(s.checks)));
  const checks: Record<string, KeyframeTarget> = {};
  for (const id of [...ids].sort()) {
    const key = parseCheckKey(id);
    if (!key) continue;
    const unit = CHECK_DEFS[key.check].unit;
    const vals = shots
      .map((s) => s.checks[id])
      .filter((c) => c && c.reliable)
      .map((c) => c!.value);
    const n = vals.length;
    const ideal = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
    const sd =
      n > 1
        ? Math.sqrt(vals.reduce((a, b) => a + (b - ideal) ** 2, 0) / (n - 1))
        : 0;
    const lo = n ? Math.min(...vals) : 0;
    const hi = n ? Math.max(...vals) : 0;
    const prev = previous?.checks[id];
    checks[id] = {
      keyframe: key.keyframe,
      check: key.check,
      unit,
      scored: n >= MIN_REFERENCE_VALUES,
      ideal,
      sd,
      passMin: lo,
      passMax: hi,
      rampSd: Math.max(MIN_RAMP[unit], rampScale(sd, hi - lo, ideal)),
      n,
      ...(prev?.override ? { override: prev.override } : {}),
    };
  }
  return {
    version: KEYFRAME_TARGETS_VERSION,
    catalog: "keyframes",
    builtFrom: meta.builtFrom,
    shootingHand: meta.shootingHand,
    shots: shots.length,
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    notes: [
      "Band = the reference shots' observed range at that keyframe: inside it scores 0.",
      "Outside, the score climbs 1 point per rampSd (the reference spread, floored per unit). Display caps at 10+.",
      "Set `override` ({ passMin, passMax, scored }) to hand-tune a check; rebuilds keep it.",
    ],
    checks,
  };
}

export interface CheckScore {
  /** 0 = on target; +1 per spread outside the band; null = not scored / not measured. */
  readonly score: number | null;
  readonly direction: "low" | "high" | null;
  /** Distance outside the band, native units (0 inside). */
  readonly magnitude: number;
  readonly passMin: number;
  readonly passMax: number;
  readonly scored: boolean;
}

/** One measured check against its target (the shared v3 scoring rule). */
export function scoreCheck(
  target: KeyframeTarget,
  check: { value: number; reliable: boolean } | undefined,
): CheckScore {
  const band = effectiveBand(target);
  const base = {
    passMin: band.passMin,
    passMax: band.passMax,
    scored: band.scored,
  };
  if (
    !band.scored ||
    !check ||
    !check.reliable ||
    !Number.isFinite(check.value)
  ) {
    return { ...base, score: null, direction: null, magnitude: 0 };
  }
  const r = scoreValue(target, check.value);
  return {
    ...base,
    score: r.score,
    direction: r.direction,
    magnitude: r.magnitude,
  };
}
