/**
 * Keyframe checks: where each body part is at five moments of the shot.
 *
 * Keyframes come from the v3 shot events (sub-frame, on smoothed signals),
 * plus one new event, `setPointReached` (the ball arriving at set point):
 *
 *   setup    = ballDropStart   — the moment before the ball starts dropping
 *   load     = ballRiseStart   — the moment before the wrists/ball start rising
 *   rise     = setPointReached — the ball reaches set point (80 % of the climb)
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
  frameAt,
  reachFraction,
  sampleAt,
  timeAt,
  valueAt,
  type EventId,
  type ShotEvents,
} from "../v3/events";
import {
  angleAt,
  computeSignals,
  type PosJoint,
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

/**
 * Bumped when a check's definition (or what's stored with it) changes, so
 * stored shots are recomputed. 2: body lengths, x scale and centre-line flag
 * stored for drawing the target zones. 3: every check measured from the
 * smoothed joint positions at the keyframe, which are stored (`points`) so
 * the review draws exactly what was measured. 4: set point / release found
 * past a hitch on the way up (a deep re-bend of the elbow), not at it.
 * 5: measured on an even time grid (dropped frames / sampling phase no longer
 * move the keyframes); Rise from the hand's height, Load past one-sample
 * stalls.
 */
export const KEYFRAME_SCHEMA_VERSION = 5 as const;

/** Joints a keyframe's checks are measured from (stored per keyframe). */
export const KEYFRAME_JOINTS = [
  "wrist",
  "elbow",
  "shoulder",
  "index",
  "hip",
  "knee",
  "ankle",
  "head",
  "hipCentre",
  "shoulderCentre",
] as const satisfies readonly PosJoint[];
export type KeyframeJoint = (typeof KEYFRAME_JOINTS)[number];

/** A joint at a keyframe: x times `xScale`, y in frame heights; null = not tracked. */
export type KeyframePoints = Readonly<
  Record<KeyframeJoint, { readonly x: number; readonly y: number } | null>
>;

/**
 * The ball has "reached" set point once the hand has covered this share of
 * its climb, from its lowest point to its height at the set point.
 */
export const ARRIVAL_HEIGHT_FRACTION = 0.8;

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
  /**
   * How the checks were measured, so a drawing of their target zones uses
   * the same space: x was multiplied by `xScale` (frame aspect, corrected for
   * camera angle on reference footage), y is frame-height units; body lengths
   * (median over the shot) in those units; `centreLine` = hips / shoulders
   * were measured at their midpoints (else the near side).
   */
  readonly xScale: number;
  readonly lengths: Readonly<{ torso: number | null; thigh: number | null }>;
  readonly centreLine: boolean;
  /** The smoothed joints each keyframe's checks were measured from. */
  readonly points: Readonly<Record<Keyframe, KeyframePoints | null>>;
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

/**
 * The frames on an even time grid (the median frame spacing), landmarks
 * interpolated between neighbouring frames. Smoothing and onset detection
 * work per sample, so without this a dropped frame (recordings drop ~1 in
 * 15) or a different sampling phase of the same motion moves the keyframes —
 * by up to ~150 ms on a real clip. On the grid, the same motion gives the
 * same keyframes however it was sampled. `frameIndex` is interpolated too,
 * so keyframes still come back as (fractional) source frames.
 */
export function resampleUniform(frames: readonly SignalFrame[]): SignalFrame[] {
  if (frames.length < 3) return [...frames];
  const ts = frames.map((f) => f.timestamp);
  const d: number[] = [];
  for (let i = 1; i < ts.length; i++) {
    const x = ts[i]! - ts[i - 1]!;
    if (x > 0) d.push(x);
  }
  if (d.length === 0) return [...frames];
  const dt = [...d].sort((a, b) => a - b)[Math.floor(d.length / 2)]!;
  const t0 = ts[0]!;
  const tN = ts.at(-1)!;
  const n = Math.floor((tN - t0) / dt + 1e-9) + 1;
  const out: SignalFrame[] = [];
  let i = 0;
  for (let k = 0; k < n; k++) {
    const t = t0 + k * dt;
    while (i < ts.length - 2 && ts[i + 1]! <= t) i++;
    const a = frames[i]!;
    const b = frames[i + 1]!;
    const span = ts[i + 1]! - ts[i]!;
    const u = span > 0 ? Math.max(0, Math.min(1, (t - ts[i]!) / span)) : 0;
    const la = a.landmarks;
    const lb = b.landmarks;
    const landmarks =
      la && lb && la.length === lb.length
        ? la.map((p, j) => {
            const q = lb[j]!;
            return {
              x: p.x + u * (q.x - p.x),
              y: p.y + u * (q.y - p.y),
              visibility: p.visibility + u * (q.visibility - p.visibility),
            };
          })
        : u < 0.5
          ? la
          : lb;
    out.push({
      frameIndex: a.frameIndex + u * (b.frameIndex - a.frameIndex),
      timestamp: t,
      landmarks,
    });
  }
  return out;
}

export function computeShotKeyframes(
  frames: readonly SignalFrame[],
  opts: KeyframeOptions,
): ShotKeyframes {
  const sig = computeSignals(resampleUniform(frames), opts);
  const detected = detectEvents(sig);
  const ev = opts.events
    ? overrideEvents(sig, detected, opts.events)
    : detected;
  return keyframesFromSignals(sig, ev);
}

/**
 * The ball reaching set point: the first point after the ball's lowest where
 * the hand has covered `ARRIVAL_HEIGHT_FRACTION` of its climb to its height
 * at `setPoint` — interpolated, never after `setPoint` (a one-motion shot
 * arrives and releases together). Read from the hand's height, not its
 * speed: the speed of a fast-moving wrist is noisy (small, blurred frames),
 * its height isn't.
 */
export function setPointReached(
  sig: ShotSignals,
  ev: ShotEvents,
): number | null {
  const sp = ev.setPoint;
  if (sp === null) return null;
  const from = ev.ballLowest ?? ev.ballRiseStart;
  if (from === null || from >= sp) return sp;
  const at = reachFraction(sig.wristY, from, sp, ARRIVAL_HEIGHT_FRACTION);
  if (at === null) return sp;
  const lo = ev.ballRiseStart ?? from;
  return Math.max(Math.min(lo, sp), Math.min(sp, at));
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

  /** A smoothed joint at sample x (null when not tracked there). */
  const joint = (j: PosJoint, x: number) => {
    const px = at(P[j].x, x);
    const py = at(P[j].y, x);
    return px === null || py === null ? null : { x: px, y: py };
  };
  /** Angle a-b-c of the smoothed joints at x (degrees). */
  const ang = (a: PosJoint, b: PosJoint, c: PosJoint, x: number) => {
    const A = joint(a, x);
    const B = joint(b, x);
    const C = joint(c, x);
    return A && B && C ? angleAt(A, B, C) : null;
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
        return ang("elbow", "wrist", "index", x);
      case "hold": {
        const r = kf.rise;
        return r === null ? null : timeAt(sig, x) - timeAt(sig, r);
      }
      // Reference footage with true limb lengths measures these in 3D.
      case "elbow_bend":
        return sig.segments3d
          ? at(sig.elbowAngle, x)
          : ang("shoulder", "elbow", "wrist", x);
      case "knee_bend":
        return sig.segments3d
          ? at(sig.kneeAngle, x)
          : ang("hip", "knee", "ankle", x);
      case "back": {
        const top = joint("shoulderCentre", x);
        const base = joint("hipCentre", x);
        return top && base
          ? (Math.atan2(f * (top.x - base.x), base.y - top.y) * 180) / Math.PI
          : null;
      }
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
    xScale: sig.aspect,
    lengths: { torso: seg.torso, thigh: seg.thigh },
    centreLine: sig.centreLine,
    points: Object.fromEntries(
      KEYFRAMES.map((k) => {
        const x = kf[k];
        if (x === null) return [k, null];
        return [
          k,
          Object.fromEntries(KEYFRAME_JOINTS.map((j) => [j, joint(j, x)])),
        ];
      }),
    ) as Record<Keyframe, KeyframePoints | null>,
  };
}

/** A keyframe's sample index from a stored source frame (for tools). */
export function keyframeSample(sig: ShotSignals, frame: number): number {
  return sampleAt(sig, frame);
}
