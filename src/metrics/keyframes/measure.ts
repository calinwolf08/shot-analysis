/**
 * Keyframe checks: where each body part is at five moments of the shot.
 *
 * Keyframes come from the v3 shot events (sub-frame, on smoothed signals),
 * plus one new event, `setPointReached` (the ball arriving at set point):
 *
 *   setup    = ballDropStart   — the moment before the ball starts dropping
 *   load     = ballRiseStart   — the moment before the wrists/ball start rising
 *   rise     = setPointReached — the ball reaches set point
 *   setPoint = setPoint        — last moment before the release (elbow starts extending)
 *   release  = armExtended     — the arm finishes extending
 *
 * Values are absolute positions (no deltas between keyframes), on the same
 * aspect-correct signals and body-length units as v3:
 *  - angles in degrees (joint angles: smaller = more bent);
 *  - heights + = higher, in torso lengths;
 *  - horizontal offsets + = toward the direction the player faces;
 *  - back lean + = leaning forward.
 * Anything that can't be measured is `reliable: false`, never guessed.
 *
 * Pure.
 */
import {
  detectEvents,
  extremum,
  frameAt,
  sampleAt,
  timeAt,
  valueAt,
  type EventId,
  type ShotEvents,
} from "../v3/events";
import {
  computeSignals,
  type Series,
  type ShotSignals,
  type SignalFrame,
  type SegmentLengths,
  type Side,
} from "../v3/signals";
import { overrideEvents } from "../v3/metrics";
import {
  CHECK_DEFS,
  KEYFRAMES,
  checkKey,
  type CheckId,
  type CheckUnit,
  type Keyframe,
} from "./catalog";

/** Bumped when a check's definition changes (stored shots are recomputed). */
export const KEYFRAME_SCHEMA_VERSION = 1 as const;

/**
 * The ball has "reached" set point once the wrist's upward speed falls below
 * this share of its fastest rise.
 */
export const ARRIVAL_SPEED_FRACTION = 0.35;

export interface KeyframeCheck {
  readonly keyframe: Keyframe;
  readonly check: CheckId;
  readonly unit: CheckUnit;
  readonly value: number;
  readonly reliable: boolean;
  /** Source frame the check was measured at (rounded; null = keyframe missing). */
  readonly frame: number | null;
  /** Why it wasn't measured. */
  readonly note?: string;
}

export interface ShotKeyframes {
  readonly schemaVersion: typeof KEYFRAME_SCHEMA_VERSION;
  /** Keyframes as fractional SOURCE frames (null = not detected). */
  readonly keyframes: Readonly<Record<Keyframe, number | null>>;
  /** Checks by id (`<keyframe>.<check>`). */
  readonly checks: Readonly<Record<string, KeyframeCheck>>;
  readonly facing: 1 | -1;
  readonly nearSide: Side;
  readonly shootingSide: Side;
}

export interface KeyframeOptions {
  aspect: number;
  shootingHand: Side;
  nearSide?: Side;
  /** Degrees off side-on, for reference (pro) footage only. */
  cameraAngle?: number;
  /** Event frames (source indexes) that replace detection (labels). */
  events?: Partial<Record<EventId, number>>;
  /** True limb lengths ÷ torso (pro calibration). */
  segmentLengths?: SegmentLengths;
}

export function computeShotKeyframes(
  frames: readonly SignalFrame[],
  opts: KeyframeOptions,
): ShotKeyframes {
  const sig = computeSignals(frames, opts);
  const detected = detectEvents(sig);
  const ev = opts.events
    ? overrideEvents(sig, detected, opts.events)
    : detected;
  return keyframesFromSignals(sig, ev);
}

/**
 * The ball reaching set point: after the elbow is most bent on the way up,
 * the first point where the wrist's upward speed drops below
 * `ARRIVAL_SPEED_FRACTION` of its fastest rise — interpolated. Never after
 * `setPoint` (a one-motion shot arrives and releases together).
 */
export function setPointReached(
  sig: ShotSignals,
  ev: ShotEvents,
): number | null {
  const sp = ev.setPoint;
  if (sp === null) return null;
  const from = ev.ballRiseStart ?? ev.ballLowest;
  if (from === null || from >= sp) return sp;
  const elbowMin = extremum(sig.elbowAngle, from, sp, "min") ?? from;
  // Upward speed between samples i and i+1 (screen y grows downward).
  const up = (i: number): number | null => {
    const a = sig.wristY[i];
    const b = sig.wristY[i + 1];
    if (a === null || a === undefined || b === null || b === undefined)
      return null;
    const dt = sig.t[i + 1]! - sig.t[i]!;
    return dt > 0 ? (a - b) / dt : null;
  };
  let peak = 0;
  for (let i = Math.floor(from); i < Math.ceil(sp); i++) {
    const v = up(i);
    if (v !== null && v > peak) peak = v;
  }
  if (peak <= 0) return sp;
  const thr = ARRIVAL_SPEED_FRACTION * peak;
  let prev: { at: number; v: number } | null = null;
  for (let i = Math.floor(elbowMin); i < Math.ceil(sp); i++) {
    const v = up(i);
    if (v === null) continue;
    const at = i + 0.5;
    if (v < thr) {
      if (!prev) return Math.max(elbowMin, Math.min(sp, at));
      const f = prev.v === v ? 0 : (prev.v - thr) / (prev.v - v);
      return Math.max(elbowMin, Math.min(sp, prev.at + f * (at - prev.at)));
    }
    prev = { at, v };
  }
  return sp;
}

/** The five keyframes as fractional SAMPLE indexes. */
export function keyframeSamples(
  sig: ShotSignals,
  ev: ShotEvents,
): Record<Keyframe, number | null> {
  const ordered = (a: number | null, b: number | null) =>
    a !== null && b !== null && a > b ? null : a;
  const release = ev.armExtended;
  const setPoint = ev.setPoint;
  const rise = setPointReached(sig, ev);
  const load = ordered(ev.ballRiseStart, rise ?? setPoint);
  const setup = ordered(ev.ballDropStart, load);
  return { setup, load, rise, setPoint, release };
}

export function keyframesFromSignals(
  sig: ShotSignals,
  ev: ShotEvents,
): ShotKeyframes {
  const kf = keyframeSamples(sig, ev);
  const seg = sig.segments;
  const P = sig.pos;
  const f = sig.facing;
  const at = (s: Series, x: number) => valueAt(s, x);
  const norm = (v: number | null, len: number | null) =>
    v === null || len === null || len <= 0 ? null : v / len;
  /** Height of a above b (+ = higher). */
  const above = (a: keyof typeof P, b: keyof typeof P, x: number) => {
    const ay = at(P[a].y, x);
    const by = at(P[b].y, x);
    return ay === null || by === null ? null : by - ay;
  };
  /** Horizontal offset a − b toward facing. */
  const fwd = (a: keyof typeof P, b: keyof typeof P, x: number) => {
    const ax = at(P[a].x, x);
    const bx = at(P[b].x, x);
    return ax === null || bx === null ? null : f * (ax - bx);
  };

  const measureAt = (k: Keyframe, c: CheckId, x: number): number | null => {
    switch (c) {
      case "hand_height":
        return k === "setup" || k === "load"
          ? norm(above("wrist", "hipCentre", x), seg.torso)
          : norm(above("wrist", "head", x), seg.torso);
      case "ball_close":
        return norm(fwd("wrist", "hipCentre", x), seg.torso);
      case "wrist_hinge":
        return at(sig.wristAngle, x);
      case "hold": {
        const r = kf.rise;
        return r === null ? null : timeAt(sig, x) - timeAt(sig, r);
      }
      case "elbow_bend":
        return at(sig.elbowAngle, x);
      case "knee_bend":
        return at(sig.kneeAngle, x);
      case "back":
        return at(sig.spineLean, x);
      case "hips_over_knees":
        return norm(fwd("hip", "knee", x), seg.thigh);
    }
  };

  const checks: Record<string, KeyframeCheck> = {};
  for (const k of KEYFRAMES) {
    const x = kf[k];
    for (const def of Object.values(CHECK_DEFS)) {
      if (!def.keyframes.includes(k)) continue;
      const base = { keyframe: k, check: def.id, unit: def.unit };
      if (x === null) {
        checks[checkKey(k, def.id)] = {
          ...base,
          value: NaN,
          reliable: false,
          frame: null,
          note: `${k} keyframe not detected`,
        };
        continue;
      }
      const v = measureAt(k, def.id, x);
      const frame = Math.round(frameAt(sig, x));
      checks[checkKey(k, def.id)] =
        v === null || !Number.isFinite(v)
          ? {
              ...base,
              value: NaN,
              reliable: false,
              frame,
              note: "not measurable",
            }
          : { ...base, value: v, reliable: true, frame };
    }
  }

  return {
    schemaVersion: KEYFRAME_SCHEMA_VERSION,
    keyframes: Object.fromEntries(
      KEYFRAMES.map((k) => [k, kf[k] === null ? null : frameAt(sig, kf[k]!)]),
    ) as Record<Keyframe, number | null>,
    checks,
    facing: sig.facing,
    nearSide: sig.nearSide,
    shootingSide: sig.shootingSide,
  };
}

/** A keyframe's sample index from a stored source frame (for tools). */
export function keyframeSample(sig: ShotSignals, frame: number): number {
  return sampleAt(sig, frame);
}
