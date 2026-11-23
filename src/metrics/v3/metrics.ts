/**
 * v3 metric catalog (Load → Rise → Set Point → Release), per the agreed list
 * in docs/practice-loop-fixes-plan.md §B-2.3.
 *
 * - Angles in degrees on aspect-correct coordinates (./signals).
 * - Distances divided by the player's OWN median segment length for the shot
 *   (thigh, shin, torso, forearm, leg = thigh + shin) — anatomy-independent.
 * - Horizontal offsets signed so + = toward the direction the player faces.
 * - Timing metrics: signed (eventB − eventA) ÷ the phase's real duration
 *   (seconds), so one number captures both ORDER (sign) and GAP (size).
 *   Negative = event B came first.
 * - Anything that can't be measured (missing event, occluded joint, too few
 *   frames) is `reliable: false` and excluded from scoring — never guessed.
 *
 * Pure.
 */
import { measure, unavailable, type Measurement } from "../v2/types";
import {
  frameAt,
  onsetBefore,
  extremum,
  phaseWindows,
  reachFraction,
  timeAt,
  valueAt,
  detectEvents,
  sampleAt,
  type EventId,
  type PhaseWindows,
  type ShotEvents,
} from "./events";
import {
  computeSignals,
  type Series,
  type ShotSignals,
  type SignalFrame,
  type SegmentLengths,
  type Side,
} from "./signals";

/**
 * Bumped when a metric's definition changes, so stored shots are recomputed
 * from their pose track on read. 3: head metrics measure head PITCH (ear →
 * nose from horizontal) instead of the neck angle against the spine.
 * 4: torso lean / hip angle on the body's centre line, ball-close to the hip
 * centre (no left/right width leaking in off a true side view).
 */
export const METRICS_V3_SCHEMA_VERSION = 4 as const;

export type MetricKind = "structure" | "timing" | "detail";
export type MetricPhase = "load" | "rise" | "setPoint" | "release";

/** Unit vocabulary for display + target files. */
export type MetricUnit =
  | "deg"
  | "phase" // fraction of the phase's duration
  | "torso"
  | "thigh"
  | "shin"
  | "forearm"
  | "leg"
  | "s";

export interface MetricV3 extends Measurement {
  readonly kind: MetricKind;
  readonly phase: MetricPhase;
  readonly unit: MetricUnit;
}

export interface ShotMetricsV3 {
  readonly schemaVersion: typeof METRICS_V3_SCHEMA_VERSION;
  /** Detected events as fractional SOURCE frames (null = not detected). */
  readonly events: Readonly<Record<keyof ShotEvents, number | null>>;
  /** Phase windows as fractional source frames. */
  readonly phases: Readonly<
    Record<keyof PhaseWindows, { start: number; end: number } | null>
  >;
  /** Scored + detail metrics by id (e.g. "load.knee_depth"). */
  readonly metrics: Readonly<Record<string, MetricV3>>;
  readonly facing: 1 | -1;
  readonly nearSide: Side;
}

/** Phases shorter than this many frames give coarse timing (flagged). */
export const LOW_RES_FRAMES = 6;
/** Window after arm extension in which the wrist snap is measured (s). */
export const SNAP_WINDOW_S = 0.3;
/** Minimum visibility to trust the guide wrist / index finger. */
export const OCCLUDED_VIS = 0.5;

type Fx = number | null; // fractional sample index

export interface ShotMetricsOptions {
  aspect: number;
  shootingHand: Side;
  nearSide?: Side;
  /**
   * Degrees off side-on, for reference (pro) footage only: horizontal
   * distances are stretched back by 1 / cos(angle). Users are never corrected.
   */
  cameraAngle?: number;
  /**
   * Event frames (SOURCE frame indexes) that replace detection — e.g. a
   * person's labelled key frames (see `labeledEventFrames`). Events not given
   * are still detected.
   */
  events?: Partial<Record<EventId, number>>;
  /**
   * True limb lengths ÷ torso (calibration; pro data only): knee and elbow
   * angles measured in 3D per frame (signals.ts `limbVector3d`).
   */
  segmentLengths?: SegmentLengths;
}

export function computeShotMetricsV3(
  frames: readonly SignalFrame[],
  opts: ShotMetricsOptions,
): ShotMetricsV3 {
  const sig = computeSignals(frames, opts);
  const detected = detectEvents(sig);
  const ev = opts.events ? overrideEvents(sig, detected, opts.events) : detected;
  return metricsFromSignals(sig, ev);
}

/** Detected events with some replaced by given source frames. */
export function overrideEvents(
  sig: ShotSignals,
  detected: ShotEvents,
  frames: Partial<Record<EventId, number>>,
): ShotEvents {
  const out: Record<string, number | null> = { ...detected };
  for (const [id, f] of Object.entries(frames)) {
    if (typeof f === "number" && Number.isFinite(f)) out[id] = sampleAt(sig, f);
  }
  return out as ShotEvents;
}

export function metricsFromSignals(
  sig: ShotSignals,
  ev: ShotEvents,
): ShotMetricsV3 {
  const w = phaseWindows(ev);
  const seg = sig.segments;
  const leg = seg.thigh !== null && seg.shin !== null ? seg.thigh + seg.shin : null;
  const out: Record<string, MetricV3> = {};
  const fr = (x: Fx) => (x === null ? [] : [Math.round(frameAt(sig, x))]);

  const put = (
    id: string,
    kind: MetricKind,
    phase: MetricPhase,
    unit: MetricUnit,
    value: number | null,
    at: Fx[],
    note?: string,
  ) => {
    const frames = at.flatMap(fr);
    const m: Measurement =
      value === null || !Number.isFinite(value)
        ? unavailable(note ?? "not measurable", frames)
        : note
          ? { ...measure(value, frames), note }
          : measure(value, frames);
    out[id] = { ...m, kind, phase, unit };
  };

  // ---- helpers over signals ------------------------------------------------
  const at = (s: Series, x: Fx) => (x === null ? null : valueAt(s, x));
  const diff = (s: Series, a: Fx, b: Fx) => {
    const va = at(s, a);
    const vb = at(s, b);
    return va === null || vb === null ? null : vb - va;
  };
  const norm = (v: number | null, len: number | null) =>
    v === null || len === null || len <= 0 ? null : v / len;
  const P = sig.pos;
  const f = sig.facing;
  /** Horizontal offset a − b toward facing, at x. */
  const fwd = (a: keyof typeof P, b: keyof typeof P, x: Fx) => {
    const ax = at(P[a].x, x);
    const bx = at(P[b].x, x);
    return ax === null || bx === null ? null : f * (ax - bx);
  };
  /** Height of a above b (+ = higher), at x. */
  const above = (a: keyof typeof P, b: keyof typeof P, x: Fx) => {
    const ay = at(P[a].y, x);
    const by = at(P[b].y, x);
    return ay === null || by === null ? null : by - ay;
  };
  const dur = (win: { start: number; end: number } | null) =>
    win ? timeAt(sig, win.end) - timeAt(sig, win.start) : null;
  const framesIn = (win: { start: number; end: number } | null) =>
    win ? frameAt(sig, win.end) - frameAt(sig, win.start) : 0;
  /** Signed (b − a) ÷ phase duration. */
  const timing = (
    id: string,
    phase: MetricPhase,
    win: { start: number; end: number } | null,
    a: Fx,
    b: Fx,
    missing: string,
  ) => {
    const d = dur(win);
    if (a === null || b === null || d === null || d <= 0) {
      put(id, "timing", phase, "phase", null, [a, b], missing);
      return;
    }
    const v = (timeAt(sig, b) - timeAt(sig, a)) / d;
    const lowRes = framesIn(win) < LOW_RES_FRAMES;
    put(id, "timing", phase, "phase", v, [a, b], lowRes ? "low resolution" : undefined);
  };

  // ---- Load ----------------------------------------------------------------
  const L = w.load;
  const deep = ev.hipLowest;
  put("load.spine_angle", "structure", "load", "deg", at(sig.spineLean, deep), [deep]);
  put("load.head_pitch", "structure", "load", "deg", at(sig.headPitch, deep), [deep]);
  const kneeMinL = L ? extremum(sig.kneeAngle, L.start, L.end + 2, "min") : null;
  put("load.knee_depth", "structure", "load", "deg", at(sig.kneeAngle, kneeMinL), [kneeMinL]);
  put("load.hip_over_knee", "structure", "load", "thigh", norm(fwd("hip", "knee", deep), seg.thigh), [deep]);
  put("load.knee_over_ankle", "structure", "load", "shin", norm(fwd("knee", "ankle", deep), seg.shin), [deep]);
  const low = ev.ballLowest;
  put("load.ball_drop", "structure", "load", "torso", norm(above("wrist", "hip", low), seg.torso), [low]);
  put("load.elbow_angle", "structure", "load", "deg", at(sig.elbowAngle, low), [low]);
  put("load.elbow_change", "structure", "load", "deg", L ? diff(sig.elbowAngle, L.start, L.end) : null, L ? [L.start, L.end] : []);
  // Wrist ↔ hip CENTRE (the shooting wrist and the near hip can be on
  // opposite sides of the body; hip width would leak in off side-on).
  const wx = at(P.wrist.x, low), wy = at(P.wrist.y, low), hx = at(P.hipCentre.x, low), hy = at(P.hipCentre.y, low);
  put(
    "load.ball_close",
    "structure",
    "load",
    "torso",
    wx !== null && wy !== null && hx !== null && hy !== null ? norm(Math.hypot(wx - hx, wy - hy), seg.torso) : null,
    [low],
  );
  timing("load.t_drop_start", "load", L, ev.hipDropStart, ev.ballDropStart, "drop start not detected");
  timing("load.t_drop_end", "load", L, ev.hipLowest, ev.ballLowest, "low point not detected");
  timing("load.t_elbow_bend", "load", L, ev.ballDropStart, ev.elbowBendStart, "elbow bend not detected");

  // ---- Rise ----------------------------------------------------------------
  const R = w.rise;
  const mid = R ? (R.start + R.end) / 2 : null;
  timing("rise.t_start", "rise", R, ev.kneesStartStraightening, ev.ballRiseStart, "rise start not detected");
  // Ball starts up vs the knees reaching their deepest bend: − = the ball was
  // already rising while the knees were still bending.
  timing("rise.t_ball_vs_knee_bottom", "rise", R, ev.kneesDeepest, ev.ballRiseStart, "deepest knee bend not detected");
  timing("rise.t_end", "rise", R, ev.kneesStraight, ev.setPoint, "knees straight / set point not detected");
  put("rise.elbow_change_1", "structure", "rise", "deg", R ? diff(sig.elbowAngle, R.start, mid) : null, R ? [R.start, mid] : []);
  put("rise.elbow_change_2", "structure", "rise", "deg", R ? diff(sig.elbowAngle, mid, R.end) : null, R ? [mid, R.end] : []);
  const hinge = (a: Fx, b: Fx, id: string) => {
    const iv = [a, b].map((x) => (x === null ? null : sig.vis.index[Math.round(x)] ?? null));
    const hidden = iv.some((v) => v === null || v < OCCLUDED_VIS);
    put(id, "structure", "rise", "deg", hidden ? null : diff(sig.wristAngle, a, b), [a, b], hidden ? "fingers not tracked" : undefined);
  };
  hinge(R?.start ?? null, mid, "rise.wrist_hinge_change_1");
  hinge(mid, R?.end ?? null, "rise.wrist_hinge_change_2");
  put("rise.spine_change", "structure", "rise", "deg", R ? diff(sig.spineLean, R.start, R.end) : null, R ? [R.start, R.end] : []);
  const spineStraight = R ? reachFraction(sig.spineLean, R.start, R.end, 0.9) : null;
  timing("rise.t_spine_vs_knees", "rise", R, ev.kneesStraight, spineStraight, "spine/knees not detected");
  put("rise.head_pitch_change", "structure", "rise", "deg", R ? diff(sig.headPitch, R.start, R.end) : null, R ? [R.start, R.end] : []);

  // ---- Set point (snapshot) --------------------------------------------------
  const sp = ev.setPoint;
  put("setPoint.wrist_vs_head", "structure", "setPoint", "torso", norm(above("wrist", "head", sp), seg.torso), [sp]);
  put("setPoint.elbow_angle", "structure", "setPoint", "deg", at(sig.elbowAngle, sp), [sp]);
  put("setPoint.spine_angle", "structure", "setPoint", "deg", at(sig.spineLean, sp), [sp]);
  put("setPoint.knee_angle", "structure", "setPoint", "deg", at(sig.kneeAngle, sp), [sp]);
  put("setPoint.hip_angle", "structure", "setPoint", "deg", at(sig.hipAngle, sp), [sp]);
  put("setPoint.hip_over_knee", "structure", "setPoint", "thigh", norm(fwd("hip", "knee", sp), seg.thigh), [sp]);
  put("setPoint.knee_over_ankle", "structure", "setPoint", "shin", norm(fwd("knee", "ankle", sp), seg.shin), [sp]);
  put("setPoint.head_pitch", "structure", "setPoint", "deg", at(sig.headPitch, sp), [sp]);

  // ---- Release -------------------------------------------------------------
  const Rel = w.release;
  const ext = ev.armExtended;
  const ex0 = at(P.elbow.x, sp), ey0 = at(P.elbow.y, sp), ex1 = at(P.elbow.x, ext), ey1 = at(P.elbow.y, ext);
  put(
    "release.elbow_path",
    "structure",
    "release",
    "deg",
    ex0 !== null && ey0 !== null && ex1 !== null && ey1 !== null && (ex1 !== ex0 || ey1 !== ey0)
      ? (Math.atan2(f * (ex1 - ex0), ey0 - ey1) * 180) / Math.PI
      : null,
    [sp, ext],
  );
  put("release.wrist_vs_head_end", "structure", "release", "torso", norm(above("wrist", "head", ext), seg.torso), [ext]);
  const gVis = ext === null ? null : sig.vis.guideWrist[Math.round(ext)] ?? null;
  const guideHidden = gVis === null || gVis < OCCLUDED_VIS;
  put("release.guide_hand_dx", "structure", "release", "forearm", guideHidden ? null : norm(fwd("guideWrist", "wrist", ext), seg.forearm), [ext], guideHidden ? "guide hand hidden" : undefined);
  put("release.guide_hand_dy", "structure", "release", "forearm", guideHidden ? null : norm(above("guideWrist", "wrist", ext), seg.forearm), [ext], guideHidden ? "guide hand hidden" : undefined);
  put("release.knee_change", "structure", "release", "deg", Rel ? diff(sig.kneeAngle, Rel.start, Rel.end) : null, Rel ? [Rel.start, Rel.end] : []);
  put("release.spine_change", "structure", "release", "deg", Rel ? diff(sig.spineLean, Rel.start, Rel.end) : null, Rel ? [Rel.start, Rel.end] : []);
  // Wrist snap: most-flexed wrist within SNAP_WINDOW_S after arm extension.
  let snap: number | null = null;
  let snapAt: Fx = null;
  let snapNote: string | undefined;
  if (ext !== null) {
    const tEnd = timeAt(sig, ext) + SNAP_WINDOW_S;
    for (let i = Math.ceil(ext); i < sig.t.length && sig.t[i]! <= tEnd; i++) {
      const a = sig.wristAngle[i];
      const v = sig.vis.index[i];
      if (a === null || a === undefined || v === null || v === undefined || v < OCCLUDED_VIS) continue;
      const flex = 180 - a;
      if (snap === null || flex > snap) {
        snap = flex;
        snapAt = i;
      }
    }
    if (snap === null) snapNote = "fingers not tracked after release";
  }
  put("release.wrist_snap", "structure", "release", "deg", snap, [snapAt ?? ext], snapNote);
  // Forward drift: hips + head toward the hoop, end of load → end of release.
  const drift = (x: Fx) => {
    const a = at(P.hip.x, x);
    const b = at(P.head.x, x);
    return a === null || b === null ? null : (a + b) / 2;
  };
  const d0 = drift(L?.end ?? null);
  const d1 = drift(Rel?.end ?? null);
  put("release.forward_drift", "structure", "release", "leg", d0 !== null && d1 !== null ? norm(f * (d1 - d0), leg) : null, [L?.end ?? null, Rel?.end ?? null]);
  timing("release.t_legs_vs_arm", "release", Rel, ev.armExtended, ev.kneesStraight, "legs/arm extension not detected");

  // ---- Details (measured, not scored) ---------------------------------------
  // Wrist path straightness during the rise: max perpendicular deviation from
  // the straight line between its start and end, ÷ torso.
  let dev: number | null = null;
  if (R) {
    const a = { x: at(P.wrist.x, R.start), y: at(P.wrist.y, R.start) };
    const b = { x: at(P.wrist.x, R.end), y: at(P.wrist.y, R.end) };
    if (a.x !== null && a.y !== null && b.x !== null && b.y !== null) {
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > 0) {
        dev = 0;
        for (let i = Math.ceil(R.start); i <= Math.floor(R.end); i++) {
          const px = P.wrist.x[i];
          const py = P.wrist.y[i];
          if (px === null || px === undefined || py === null || py === undefined) continue;
          const d = Math.abs((b.x - a.x) * (a.y - py) - (a.x - px) * (b.y - a.y)) / len;
          dev = Math.max(dev, d);
        }
        dev = norm(dev, seg.torso);
      }
    }
  }
  put("detail.wrist_path_deviation", "detail", "rise", "torso", dev, R ? [R.start, R.end] : []);
  let elbowHigh: number | null = null;
  let elbowHighAt: Fx = null;
  if (Rel) {
    for (let i = Math.ceil(Rel.start); i <= Math.floor(Rel.end); i++) {
      const h = above("elbow", "head", i);
      if (h !== null && (elbowHigh === null || h > elbowHigh)) {
        elbowHigh = h;
        elbowHighAt = i;
      }
    }
  }
  put("detail.elbow_height_vs_head", "detail", "release", "torso", norm(elbowHigh, seg.torso), [elbowHighAt]);
  // Jump timing: arm extension relative to take-off (feet leave the ground =
  // onset of the near ankle rising toward its highest point), seconds.
  const jumpPeak = ext !== null ? extremum(P.ankle.y, ext - 10, ext + 10, "min") : null;
  const takeoff = jumpPeak !== null ? onsetBefore(P.ankle.y, jumpPeak, -1, Math.max(0, jumpPeak - 20)) : null;
  put(
    "detail.release_vs_takeoff",
    "detail",
    "release",
    "s",
    ext !== null && takeoff !== null ? timeAt(sig, ext) - timeAt(sig, takeoff) : null,
    [takeoff, ext],
  );
  let extMax: number | null = null;
  if (ext !== null) {
    const tEnd = timeAt(sig, ext) + SNAP_WINDOW_S;
    for (let i = Math.floor(ext); i < sig.t.length && sig.t[i]! <= tEnd; i++) {
      const a = sig.elbowAngle[i];
      if (a !== null && a !== undefined && (extMax === null || a > extMax)) extMax = a;
    }
  }
  put("detail.follow_through_elbow_max", "detail", "release", "deg", extMax, [ext]);

  const toFrames = (x: number | null) => (x === null ? null : frameAt(sig, x));
  const win = (x: { start: number; end: number } | null) =>
    x ? { start: frameAt(sig, x.start), end: frameAt(sig, x.end) } : null;
  return {
    schemaVersion: METRICS_V3_SCHEMA_VERSION,
    events: Object.fromEntries(
      Object.entries(ev).map(([k, v]) => [k, toFrames(v)]),
    ) as ShotMetricsV3["events"],
    phases: { load: win(w.load), rise: win(w.rise), release: win(w.release) },
    metrics: out,
    facing: sig.facing,
    nearSide: sig.nearSide,
  };
}

/** Flat `{ id, value, reliable }` rows (the shape targets are keyed by). */
export function flattenMetricsV3(m: ShotMetricsV3): {
  id: string;
  value: number;
  reliable: boolean;
  frames: readonly number[];
  kind: MetricKind;
  phase: MetricPhase;
  unit: MetricUnit;
  note?: string;
}[] {
  return Object.entries(m.metrics).map(([id, x]) => ({
    id,
    value: x.value,
    reliable: x.reliable,
    frames: x.frames,
    kind: x.kind,
    phase: x.phase,
    unit: x.unit,
    ...(x.note !== undefined ? { note: x.note } : {}),
  }));
}
