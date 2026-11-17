/**
 * v3 per-frame body signals for one shot window.
 *
 * Fixes two problems in the v2 measurements:
 *  - **Aspect ratio.** Landmarks are normalized 0..1 on EACH axis, so angles
 *    computed directly on (x, y) are distorted on any non-square frame — and
 *    distorted differently for a landscape reference clip than for a portrait
 *    phone. Here x is scaled by the frame aspect (width ÷ height) first, so
 *    every angle and length is in true proportions.
 *  - **Timing.** Each frame keeps its real timestamp (frames may be unevenly
 *    spaced live), instead of assuming index ÷ fps.
 *
 * Signals are lightly smoothed (Savitzky–Golay, 5-point quadratic) after
 * short gaps (≤ 3 frames of missing/occluded joints) are bridged linearly.
 * Longer gaps stay null.
 *
 * Side conventions: the SHOOTING arm comes from the shooting hand; the legs
 * and torso use the NEAR side (higher visibility over the window), since the
 * far side is occluded side-on.
 */

export interface SignalLandmark {
  readonly x: number;
  readonly y: number;
  readonly visibility: number;
}
export interface SignalFrame {
  readonly frameIndex: number;
  /** Seconds. */
  readonly timestamp: number;
  readonly landmarks: readonly SignalLandmark[] | null;
}

export type Side = "left" | "right";
export type Series = (number | null)[];

export interface ShotSignals {
  /** Frame indexes covered (source indexes), one per sample. */
  readonly frameIndex: readonly number[];
  /** Seconds, one per sample. */
  readonly t: readonly number[];
  readonly aspect: number;
  readonly shootingSide: Side;
  readonly nearSide: Side;
  /** Shooting wrist height (screen y, DOWN is +, units of frame height). */
  readonly wristY: Series;
  /** Near hip screen y. */
  readonly hipY: Series;
  /** Near knee angle hip-knee-ankle (deg; 180 = straight). */
  readonly kneeAngle: Series;
  /** Near hip angle shoulder-hip-knee (deg; 180 = upright). */
  readonly hipAngle: Series;
  /** Shooting elbow angle shoulder-elbow-wrist (deg). */
  readonly elbowAngle: Series;
  /** Torso lean from vertical, hip→shoulder (deg; sign: + = toward facing). */
  readonly spineLean: Series;
  /** Median segment lengths over the window (frame-height units). */
  readonly segments: Readonly<Record<SegmentName, number | null>>;
}

export type SegmentName = "thigh" | "shin" | "torso" | "forearm" | "upperArm";

const LM = {
  nose: 0,
  ear: { left: 7, right: 8 },
  shoulder: { left: 11, right: 12 },
  elbow: { left: 13, right: 14 },
  wrist: { left: 15, right: 16 },
  hip: { left: 23, right: 24 },
  knee: { left: 25, right: 26 },
  ankle: { left: 27, right: 28 },
} as const;

export const MIN_VIS = 0.3;

type P = { x: number; y: number };

function pt(
  f: SignalFrame,
  i: number,
  aspect: number,
  minVis = MIN_VIS,
): P | null {
  const l = f.landmarks?.[i];
  if (!l || l.visibility < minVis) return null;
  return { x: l.x * aspect, y: l.y };
}

/** Interior angle at b (deg). */
export function angleAt(a: P, b: P, c: P): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const d = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (d === 0) return NaN;
  const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / d));
  return (Math.acos(cos) * 180) / Math.PI;
}

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

/** Fills interior gaps of up to `maxGap` nulls by linear interpolation. */
export function bridgeGaps(s: Series, maxGap = 3): Series {
  const out = [...s];
  let i = 0;
  while (i < out.length) {
    if (out[i] !== null) {
      i++;
      continue;
    }
    const startGap = i;
    while (i < out.length && out[i] === null) i++;
    const len = i - startGap;
    const before = out[startGap - 1];
    const after = out[i];
    if (
      len <= maxGap &&
      before !== null &&
      before !== undefined &&
      after !== null &&
      after !== undefined
    ) {
      for (let k = 0; k < len; k++) {
        out[startGap + k] = before + ((after - before) * (k + 1)) / (len + 1);
      }
    }
  }
  return out;
}

/** 5-point quadratic Savitzky–Golay; edges / gaps keep the raw value. */
export function smooth(s: Series): Series {
  const c = [-3, 12, 17, 12, -3];
  return s.map((v, i) => {
    if (v === null) return null;
    let acc = 0;
    for (let k = -2; k <= 2; k++) {
      const w = s[i + k];
      if (w === null || w === undefined) return v;
      acc += c[k + 2]! * w;
    }
    return acc / 35;
  });
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** The side whose leg/torso joints are more visible over the window. */
export function nearSideOf(frames: readonly SignalFrame[]): Side {
  let left = 0;
  let right = 0;
  for (const f of frames) {
    for (const j of ["shoulder", "hip", "knee", "ankle"] as const) {
      left += f.landmarks?.[LM[j].left]?.visibility ?? 0;
      right += f.landmarks?.[LM[j].right]?.visibility ?? 0;
    }
  }
  return left >= right ? "left" : "right";
}

export function computeSignals(
  frames: readonly SignalFrame[],
  opts: { aspect: number; shootingHand: Side; nearSide?: Side },
): ShotSignals {
  const a = opts.aspect;
  const shoot = opts.shootingHand;
  const near = opts.nearSide ?? nearSideOf(frames);
  // Which way the player faces (+x or −x on screen): nose ahead of the ears.
  let facing = 0;
  for (const f of frames) {
    const n = pt(f, LM.nose, a);
    const e = pt(f, LM.ear[near], a);
    if (n && e) facing += n.x - e.x;
  }
  const facingSign = facing >= 0 ? 1 : -1;

  const wristY: Series = [];
  const hipY: Series = [];
  const knee: Series = [];
  const hipA: Series = [];
  const elbow: Series = [];
  const spine: Series = [];
  const seg: Record<SegmentName, number[]> = {
    thigh: [],
    shin: [],
    torso: [],
    forearm: [],
    upperArm: [],
  };

  for (const f of frames) {
    const w = pt(f, LM.wrist[shoot], a);
    const e = pt(f, LM.elbow[shoot], a);
    const s = pt(f, LM.shoulder[shoot], a);
    const sn = pt(f, LM.shoulder[near], a);
    const h = pt(f, LM.hip[near], a);
    const k = pt(f, LM.knee[near], a);
    const an = pt(f, LM.ankle[near], a);
    wristY.push(w ? w.y : null);
    hipY.push(h ? h.y : null);
    knee.push(h && k && an ? angleAt(h, k, an) : null);
    hipA.push(sn && h && k ? angleAt(sn, h, k) : null);
    elbow.push(s && e && w ? angleAt(s, e, w) : null);
    spine.push(
      sn && h
        ? (Math.atan2(facingSign * (sn.x - h.x), h.y - sn.y) * 180) / Math.PI
        : null,
    );
    if (h && k) seg.thigh.push(dist(h, k));
    if (k && an) seg.shin.push(dist(k, an));
    if (sn && h) seg.torso.push(dist(sn, h));
    if (e && w) seg.forearm.push(dist(e, w));
    if (s && e) seg.upperArm.push(dist(s, e));
  }

  const prep = (s: Series) => smooth(bridgeGaps(s));
  return {
    frameIndex: frames.map((f) => f.frameIndex),
    t: frames.map((f) => f.timestamp),
    aspect: a,
    shootingSide: shoot,
    nearSide: near,
    wristY: prep(wristY),
    hipY: prep(hipY),
    kneeAngle: prep(knee),
    hipAngle: prep(hipA),
    elbowAngle: prep(elbow),
    spineLean: prep(spine),
    segments: {
      thigh: median(seg.thigh),
      shin: median(seg.shin),
      torso: median(seg.torso),
      forearm: median(seg.forearm),
      upperArm: median(seg.upperArm),
    },
  };
}
