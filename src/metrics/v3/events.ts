/**
 * v3 shot events with SUB-FRAME timing, and the phase windows built on them.
 *
 * At 30 fps a reference rise lasts ~4 frames (25 % of the rise per frame) and
 * live tracking runs at 15–30 fps, so timing metrics expressed as a percent of
 * a phase need more than whole frames. Events are located on the smoothed
 * signals (./signals) and refined between samples:
 *  - extrema (lowest point, deepest bend, most-bent elbow): parabola through
 *    the extreme sample and its neighbours;
 *  - onsets (movement starts): where the velocity toward the coming extremum
 *    first exceeds a fraction of its peak, interpolated between samples;
 *  - completions (knees / arm straight): where the signal crosses a fraction
 *    of its excursion, interpolated between samples.
 *
 * Positions are fractional SAMPLE indexes into the signals; `frameAt` / `timeAt`
 * convert them to fractional source frames / seconds.
 */
import type { Series, ShotSignals } from "./signals";

export type EventId =
  | "ballDropStart"
  | "ballLowest"
  | "ballRiseStart"
  | "hipDropStart"
  | "hipLowest"
  | "kneesDeepest"
  | "kneesStartStraightening"
  | "kneesStraight"
  | "elbowBendStart"
  | "setPoint"
  | "armExtended";

export type ShotEvents = Readonly<Record<EventId, number | null>>;

export interface PhaseWindow {
  readonly start: number;
  readonly end: number;
}
export interface PhaseWindows {
  readonly load: PhaseWindow | null;
  readonly rise: PhaseWindow | null;
  readonly release: PhaseWindow | null;
}

/** Fraction of peak velocity that counts as "moving" for onsets. */
export const ONSET_FRACTION = 0.2;
/** Fraction of the excursion that counts as "straight" for completions. */
export const COMPLETE_FRACTION = 0.9;

// ---- sub-frame primitives ---------------------------------------------------

/** Index of the extreme non-null value in [lo, hi], refined by a parabola. */
export function extremum(
  s: Series,
  lo: number,
  hi: number,
  kind: "min" | "max",
): number | null {
  const a = Math.max(0, Math.floor(lo));
  const b = Math.min(s.length - 1, Math.ceil(hi));
  let best = -1;
  for (let i = a; i <= b; i++) {
    const v = s[i];
    if (v === null || v === undefined) continue;
    if (best < 0 || (kind === "min" ? v < s[best]! : v > s[best]!)) best = i;
  }
  if (best < 0) return null;
  const y0 = s[best - 1];
  const y1 = s[best]!;
  const y2 = s[best + 1];
  if (
    best <= a ||
    best >= b ||
    y0 === null ||
    y0 === undefined ||
    y2 === null ||
    y2 === undefined
  ) {
    return best;
  }
  const denom = y0 - 2 * y1 + y2;
  if (denom === 0) return best;
  const off = (0.5 * (y0 - y2)) / denom;
  return best + Math.max(-0.5, Math.min(0.5, off));
}

/**
 * Onset of the movement that ends at `peak`: walking back from the peak, the
 * last point where the velocity toward it (`dir` = +1 rising values, −1
 * falling) is still at least `frac` of its peak velocity — interpolated.
 */
export function onsetBefore(
  s: Series,
  peak: number,
  dir: 1 | -1,
  lo: number,
  frac = ONSET_FRACTION,
): number | null {
  const p = Math.round(peak);
  const a = Math.max(0, Math.floor(lo));
  // v[i] = velocity between samples i and i+1 (lives at i + 0.5).
  const v: (number | null)[] = [];
  for (let i = a; i < p; i++) {
    const x = s[i];
    const y = s[i + 1];
    v.push(x === null || x === undefined || y === null || y === undefined ? null : dir * (y - x));
  }
  // Fastest moment of the approach (the velocity is ~0 AT the peak itself).
  let vmax = 0;
  let iMax = -1;
  for (let k = 0; k < v.length; k++) {
    const x = v[k];
    if (x !== null && x !== undefined && x > vmax) {
      vmax = x;
      iMax = k;
    }
  }
  if (vmax <= 0) return null;
  const thr = frac * vmax;
  let i = iMax;
  while (i >= 0 && v[i] !== null && v[i]! >= thr) i--;
  if (i < 0 || v[i] === null) return a + i + 1.5; // moving from the window start
  // Crossing between v[i] (< thr) at a+i+0.5 and v[i+1] (≥ thr) at a+i+1.5.
  const lo2 = v[i]!;
  const hi2 = v[i + 1]!;
  const f = hi2 === lo2 ? 0 : (thr - lo2) / (hi2 - lo2);
  return a + i + 0.5 + f;
}

/**
 * First point after `from` where the signal has covered `frac` of the way
 * from its value at `from` to its value at `to` — interpolated.
 */
export function reachFraction(
  s: Series,
  from: number,
  to: number,
  frac = COMPLETE_FRACTION,
): number | null {
  const v0 = valueAt(s, from);
  const v1 = valueAt(s, to);
  if (v0 === null || v1 === null || v0 === v1) return null;
  const target = v0 + frac * (v1 - v0);
  const sign = Math.sign(v1 - v0);
  for (let i = Math.floor(from); i < Math.ceil(to); i++) {
    const x = s[i];
    const y = s[i + 1];
    if (x === null || x === undefined || y === null || y === undefined) continue;
    if (sign * (y - target) >= 0 && sign * (x - target) < 0) {
      return i + (target - x) / (y - x);
    }
  }
  return to;
}

/** Linearly interpolated value at a fractional index. */
export function valueAt(s: Series, idx: number): number | null {
  const i = Math.floor(idx);
  const f = idx - i;
  const a = s[i];
  if (a === null || a === undefined) return null;
  if (f === 0) return a;
  const b = s[i + 1];
  if (b === null || b === undefined) return a;
  return a + f * (b - a);
}

/** Fractional sample index → fractional source frame / seconds. */
export function frameAt(sig: ShotSignals, idx: number): number {
  return interp(sig.frameIndex, idx);
}
export function timeAt(sig: ShotSignals, idx: number): number {
  return interp(sig.t, idx);
}
function interp(xs: readonly number[], idx: number): number {
  const i = Math.max(0, Math.min(xs.length - 1, Math.floor(idx)));
  const j = Math.min(xs.length - 1, i + 1);
  return xs[i]! + (idx - i) * (xs[j]! - xs[i]!);
}

/**
 * Walks back in time from `from` while the signal keeps moving toward a
 * `kind` extremum (values rising for "max", falling for "min"), tolerating
 * noise of `tol`; returns that nearest preceding extremum, refined.
 */
export function previousExtremum(
  s: Series,
  from: number,
  kind: "min" | "max",
  tol = 0,
): number | null {
  const sgn = kind === "max" ? 1 : -1;
  let i = Math.round(from);
  let best = i;
  while (i > 0) {
    const cur = s[i];
    const prev = s[i - 1];
    if (prev === null || prev === undefined || cur === null || cur === undefined) break;
    if (sgn * (prev - (s[best] ?? prev)) > 0) best = i - 1;
    // Stop once we've clearly come back down from the extremum.
    if (sgn * ((s[best] ?? prev) - prev) > tol) break;
    i--;
  }
  return extremum(s, best - 1, best + 1, kind);
}

/**
 * Walks FORWARD from `from` while the signal keeps moving toward a `kind`
 * extremum, tolerating noise of `tol`; returns that next extremum, refined.
 * (E.g. the knees' full extension right after the drive — not a later
 * re-straightening after landing.)
 */
export function nextExtremum(
  s: Series,
  from: number,
  kind: "min" | "max",
  tol = 0,
): number | null {
  const sgn = kind === "max" ? 1 : -1;
  let i = Math.round(from);
  let best = i;
  while (i < s.length - 1) {
    const cur = s[i];
    const next = s[i + 1];
    if (next === null || next === undefined || cur === null || cur === undefined) break;
    if (sgn * (next - (s[best] ?? next)) > 0) best = i + 1;
    if (sgn * ((s[best] ?? next) - next) > tol) break;
    i++;
  }
  return extremum(s, best - 1, best + 1, kind);
}

/**
 * The first point where the signal comes within `tol` of its overall `kind`
 * extremum, refined to the local extremum there.
 */
export function firstArrival(
  s: Series,
  kind: "min" | "max",
  tol: number,
): number | null {
  const global = extremum(s, 0, s.length - 1, kind);
  if (global === null) return null;
  const g = s[Math.round(global)]!;
  for (let i = 0; i < s.length; i++) {
    const v = s[i];
    if (v === null || v === undefined) continue;
    if (kind === "min" ? v <= g + tol : v >= g - tol) {
      return nextExtremum(s, i, kind, tol);
    }
  }
  return global;
}

/** Robust noise scale: 5 % of the series' range. */
function tolOf(s: Series): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of s) {
    if (v === null) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return Number.isFinite(lo) ? 0.05 * (hi - lo) : 0;
}

// ---- events -----------------------------------------------------------------

/**
 * Detects the shot events within the signals (which should span the shot plus
 * some context on both sides).
 */
export function detectEvents(sig: ShotSignals): ShotEvents {
  // The hand's first arrival at (near) its highest point anchors the shot —
  // the release. The absolute highest frame can come later (a held follow-
  // through), and anchoring there would let the landing dip pose as the load.
  const peak = firstArrival(sig.wristY, "min", tolOf(sig.wristY));
  const none: ShotEvents = {
    ballDropStart: null,
    ballLowest: null,
    ballRiseStart: null,
    hipDropStart: null,
    hipLowest: null,
    kneesDeepest: null,
    kneesStartStraightening: null,
    kneesStraight: null,
    elbowBendStart: null,
    setPoint: null,
    armExtended: null,
  };
  if (peak === null) return none;

  // The dip immediately before the shot (not an earlier catch/dribble).
  const ballLowest = previousExtremum(
    sig.wristY,
    peak,
    "max",
    tolOf(sig.wristY),
  );
  const ballDropStart =
    ballLowest !== null ? onsetBefore(sig.wristY, ballLowest, 1, 0) : null;
  // Rise start: the hand's upward speed reaches 10 % of its peak (on the
  // labeled corpus this tracks "ball starts upward" best; the turning point
  // itself is often a flat stretch).
  const ballRiseStart =
    ballLowest !== null
      ? onsetBefore(sig.wristY, peak, -1, ballLowest, 0.1)
      : null;

  // The elbow can be nearly straight at the ball's lowest point (arm hanging
  // with the ball), so: most-bent elbow during the rise first, then the
  // extension that follows it.
  const riseFrom = ballRiseStart ?? ballLowest ?? 0;
  const elbowMin = extremum(sig.elbowAngle, riseFrom, peak, "min");
  const elbowMax =
    elbowMin !== null
      ? nextExtremum(sig.elbowAngle, elbowMin, "max", tolOf(sig.elbowAngle))
      : null;
  const setPoint =
    elbowMax !== null && elbowMin !== null
      ? (onsetBefore(sig.elbowAngle, elbowMax, 1, elbowMin) ?? elbowMin)
      : null;
  const armExtended =
    setPoint !== null && elbowMax !== null && elbowMin !== null
      ? reachFraction(sig.elbowAngle, elbowMin, elbowMax)
      : null;

  // Legs: searched in a window anchored on the ball events (the most reliable
  // ones) — from just before the ball's lowest point to the set point — so a
  // landing after the jump can never pose as the load.
  const legLo = Math.max(0, (ballLowest ?? 0) - 10);
  const legHi = setPoint ?? peak;
  const hipLowest = extremum(sig.hipY, legLo, legHi, "max");
  const hipDropStart =
    hipLowest !== null ? onsetBefore(sig.hipY, hipLowest, 1, 0) : null;

  // The deepest knee bend belongs with the hips' low point (an earlier bend —
  // a catch or dribble — must not be picked).
  const kneeMin = extremum(
    sig.kneeAngle,
    hipLowest !== null ? Math.max(legLo, hipLowest - 5) : legLo,
    legHi,
    "min",
  );
  const kneeMax =
    kneeMin !== null
      ? nextExtremum(sig.kneeAngle, kneeMin, "max", tolOf(sig.kneeAngle))
      : null;
  // Knees straight: 80 % of the way from deepest bend to full extension
  // (knees rarely lock fully; 80 % tracks the labels with ~0 bias).
  const kneesStraight =
    kneeMin !== null && kneeMax !== null
      ? reachFraction(sig.kneeAngle, kneeMin, kneeMax, 0.8)
      : null;

  // Elbow starts bending during the load (toward its load minimum).
  const loadElbowMin =
    ballLowest !== null
      ? extremum(sig.elbowAngle, 0, ballLowest + 2, "min")
      : null;
  const elbowBendStart =
    loadElbowMin !== null
      ? onsetBefore(sig.elbowAngle, loadElbowMin, -1, 0)
      : null;

  return {
    ballDropStart,
    ballLowest,
    ballRiseStart,
    hipDropStart,
    hipLowest,
    // Deepest knee bend (the knees stop bending).
    kneesDeepest: kneeMin,
    // Knees START straightening: onset of extension after the deepest bend.
    kneesStartStraightening:
      kneeMin !== null && kneeMax !== null
        ? (onsetBefore(sig.kneeAngle, kneeMax, 1, kneeMin) ?? kneeMin)
        : kneeMin,
    kneesStraight,
    elbowBendStart,
    setPoint,
    armExtended,
  };
}

/** Phase windows per the agreed definitions (fractional sample indexes). */
export function phaseWindows(e: ShotEvents): PhaseWindows {
  const starts = [e.ballDropStart, e.hipDropStart].filter(
    (v): v is number => v !== null,
  );
  const ends = [e.ballLowest, e.hipLowest].filter(
    (v): v is number => v !== null,
  );
  const load =
    starts.length && ends.length
      ? { start: Math.min(...starts), end: Math.max(...ends) }
      : null;
  const rise =
    load && e.setPoint !== null && e.setPoint > load.end
      ? { start: load.end, end: e.setPoint }
      : null;
  const release =
    e.setPoint !== null && e.armExtended !== null && e.armExtended > e.setPoint
      ? { start: e.setPoint, end: e.armExtended }
      : null;
  return { load, rise, release };
}
