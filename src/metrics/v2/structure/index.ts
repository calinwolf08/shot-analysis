/**
 * Structure metrics — per-phase body mechanics (Step 3).
 *
 * Built on the shared posture core plus phase-specific measurements: Load depth
 * and wrist setup, Rise wrist-cock and wrist-path, Set-point wrist/elbow,
 * Release guide-hand timing and elbow height, Follow-through wrist snap and
 * elbow extension. Every value is a Measurement carrying its frame(s) and a
 * reliability flag; anything that can't be measured (wrong view, occluded
 * landmarks, missing keyframe) is returned unavailable, never guessed.
 *
 * @see docs/implementation-plan-metrics-overhaul.md (Step 3)
 */

import type { Frame, KeyframeId } from "../../../testing/types";
import { LANDMARK_INDICES } from "../../../types";
import { calculateAngle as calcAngle } from "../../../utils/geometry";
import {
  bodyScaleY,
  heightAboveFeet,
  normTime,
} from "../normalize";
import { measure, unavailable, type Measurement, type StructureMetrics } from "../types";
import {
  armIndices,
  elbowAngle,
  pt,
  wristCockAngle,
  wristSeparation,
  shoulderWidth,
  type ShootingHand,
} from "./geometry";
import { derivePhaseRanges, type FrameRange } from "./phases";
import { posturePhase, postureSnapshot, type FrameLookup } from "./posture";

export interface StructureOptions {
  readonly startFrame: number;
  readonly endFrame: number;
  readonly cameraOrientation: string;
  readonly shootingHand: ShootingHand;
}

// ---- small local geometry helpers ------------------------------------------

/** Midpoint of two visible landmarks, or null. */
function midpoint(
  frame: Frame,
  i: number,
  j: number,
): { x: number; y: number } | null {
  const a = pt(frame, i);
  const b = pt(frame, j);
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Height of the wrist-midpoint (the ball) above the feet, body-scaled. */
function ballHeight(frame: Frame): number | null {
  const mid = midpoint(frame, LANDMARK_INDICES.LEFT_WRIST, LANDMARK_INDICES.RIGHT_WRIST);
  const ankleY = ((): number | null => {
    const l = pt(frame, LANDMARK_INDICES.LEFT_ANKLE);
    const r = pt(frame, LANDMARK_INDICES.RIGHT_ANKLE);
    if (l && r) return (l.y + r.y) / 2;
    return l?.y ?? r?.y ?? null;
  })();
  const scale = bodyScaleY(frame);
  if (!mid || ankleY === null || scale === null) return null;
  return (ankleY - mid.y) / scale;
}

/** Signed height of a joint above the head (positive = above head), scaled. */
function heightAboveHead(frame: Frame, jointIndex: number): number | null {
  const joint = pt(frame, jointIndex);
  const head = pt(frame, LANDMARK_INDICES.NOSE);
  const scale = bodyScaleY(frame);
  if (!joint || !head || scale === null) return null;
  return (head.y - joint.y) / scale;
}

/** Body-scaled distance from a joint to the hip center (2D). */
function distanceToBody(frame: Frame, jointIndex: number): number | null {
  const joint = pt(frame, jointIndex);
  const hip = midpoint(frame, LANDMARK_INDICES.LEFT_HIP, LANDMARK_INDICES.RIGHT_HIP);
  const scale = bodyScaleY(frame);
  if (!joint || !hip || scale === null) return null;
  return Math.hypot(joint.x - hip.x, joint.y - hip.y) / scale;
}

// ---- main -------------------------------------------------------------------

export function computeStructure(
  frames: readonly Frame[],
  keyframes: ReadonlyMap<KeyframeId, number | null>,
  opts: StructureOptions,
): StructureMetrics {
  const { startFrame, endFrame, cameraOrientation, shootingHand } = opts;
  const byIndex = new Map<number, Frame>();
  for (const f of frames) byIndex.set(f.frameIndex, f);
  const getFrame: FrameLookup = (i) => byIndex.get(i) ?? null;
  const framesIn = (r: FrameRange): Frame[] => {
    const out: Frame[] = [];
    for (let i = r.start; i <= r.end; i++) {
      const f = byIndex.get(i);
      if (f) out.push(f);
    }
    return out;
  };
  const arm = armIndices(shootingHand);
  const phases = derivePhaseRanges(keyframes, startFrame, endFrame);
  const na = (why: string) => unavailable(why);
  const result: StructureMetrics = {};

  // ---- Gather (snapshot) --------------------------------------------------
  if (phases.gather !== null) {
    const g = getFrame(phases.gather);
    const bh = g ? ballHeight(g) : null;
    const gather: Record<string, Measurement> = {
      ...postureSnapshot(getFrame, phases.gather, cameraOrientation),
      ball_height:
        bh !== null ? measure(bh, [phases.gather]) : na("ball not tracked at gather"),
    };
    result.gather = gather;
  }

  // ---- Load (range) -------------------------------------------------------
  if (phases.load) {
    const r = phases.load;
    const load: Record<string, Measurement> = {
      ...posturePhase(getFrame, r, cameraOrientation),
    };
    // Depth: how tall at start, how deep the hips/ball get.
    const hipStart = ((f) => (f ? heightAboveFeet(f, LANDMARK_INDICES.LEFT_HIP) ?? heightAboveFeet(f, LANDMARK_INDICES.RIGHT_HIP) : null))(getFrame(r.start));
    let hipMin: number | null = null;
    let hipMinFrame = r.start;
    let ballMin: number | null = null;
    let ballMinFrame = r.start;
    for (const f of framesIn(r)) {
      const hip = heightAboveFeet(f, LANDMARK_INDICES.LEFT_HIP) ?? heightAboveFeet(f, LANDMARK_INDICES.RIGHT_HIP);
      if (hip !== null && (hipMin === null || hip < hipMin)) {
        hipMin = hip;
        hipMinFrame = f.frameIndex;
      }
      const b = ballHeight(f);
      if (b !== null && (ballMin === null || b < ballMin)) {
        ballMin = b;
        ballMinFrame = f.frameIndex;
      }
    }
    load.start_height = hipStart !== null ? measure(hipStart, [r.start]) : na("hip not tracked at load start");
    load.hip_depth = hipMin !== null ? measure(hipMin, [hipMinFrame]) : na("hip not tracked in load");
    load.depth_drop =
      hipStart !== null && hipMin !== null
        ? measure(hipStart - hipMin, [r.start, hipMinFrame])
        : na("hip depth not measurable");
    load.ball_low_height = ballMin !== null ? measure(ballMin, [ballMinFrame]) : na("ball not tracked in load");
    // Wrist setup: cock, distance to body, height — start / end / delta.
    addStartEndDelta(load, "wrist_cock", getFrame, r, (f) => wristCockAngle(f, arm.shooting));
    addStartEndDelta(load, "wrist_dist", getFrame, r, (f) => distanceToBody(f, arm.shooting.wrist));
    addStartEndDelta(load, "wrist_height", getFrame, r, (f) => heightAboveFeet(f, arm.shooting.wrist));
    result.load = load;
  }

  // ---- Rise (range) -------------------------------------------------------
  if (phases.rise) {
    const r = phases.rise;
    const rise: Record<string, Measurement> = {
      ...posturePhase(getFrame, r, cameraOrientation),
    };
    // Wrist cock at rise start + peak cock (min angle = most cocked) in phase.
    const startCock = ((f) => (f ? wristCockAngle(f, arm.shooting) : null))(getFrame(r.start));
    rise.wrist_cock_start = startCock !== null ? measure(startCock, [r.start]) : na("wrist landmarks not tracked");
    let peakCock: number | null = null;
    let peakFrame = r.start;
    for (const f of framesIn(r)) {
      const c = wristCockAngle(f, arm.shooting);
      if (c !== null && (peakCock === null || c < peakCock)) {
        peakCock = c;
        peakFrame = f.frameIndex;
      }
    }
    rise.wrist_cock_peak = peakCock !== null ? measure(peakCock, [peakFrame]) : na("wrist landmarks not tracked");
    rise.wrist_cock_peak_t =
      peakCock !== null ? measure(normTime(peakFrame, startFrame, endFrame), [peakFrame]) : na("wrist landmarks not tracked");
    // Wrist path straightness: max lateral deviation from the start→end line.
    rise.wrist_path_deviation = wristPathDeviation(framesIn(r), arm.shooting.wrist);
    result.rise = rise;
  }

  // ---- Set point (snapshot) ----------------------------------------------
  if (phases.setPoint !== null) {
    const sp = phases.setPoint;
    const f = getFrame(sp);
    const setPoint: Record<string, Measurement> = {
      ...postureSnapshot(getFrame, sp, cameraOrientation),
    };
    const wh = f ? heightAboveHead(f, arm.shooting.wrist) : null;
    setPoint.wrist_height_vs_head = wh !== null ? measure(wh, [sp]) : na("wrist/head not tracked");
    const cock = f ? wristCockAngle(f, arm.shooting) : null;
    setPoint.wrist_cock = cock !== null ? measure(cock, [sp]) : na("wrist landmarks not tracked");
    const ea = f ? elbowAngle(f, arm.shooting) : null;
    setPoint.elbow_angle = ea !== null ? measure(ea, [sp]) : na("elbow not tracked");
    // Elbow flare: angle at the shoulder (hip→shoulder→elbow); larger = flared.
    const flare = f
      ? ((): number | null => {
          const a = pt(f, arm.shooting.shoulder);
          if (!a) return null;
          const hipIdx = shootingHand === "right" ? LANDMARK_INDICES.RIGHT_HIP : LANDMARK_INDICES.LEFT_HIP;
          const hip = pt(f, hipIdx);
          const elbow = pt(f, arm.shooting.elbow);
          if (!hip || !elbow) return null;
          return calcAngle(hip, a, elbow);
        })()
      : null;
    setPoint.elbow_flare = flare !== null ? measure(flare, [sp]) : na("elbow flare not measurable");
    result.setPoint = setPoint;
  }

  // ---- Release (range) ----------------------------------------------------
  if (phases.release) {
    const r = phases.release;
    const release: Record<string, Measurement> = {
      ...posturePhase(getFrame, r, cameraOrientation),
    };
    // Guide-hand duration: time until the two hands separate past ~1 shoulder
    // width, as a fraction of the whole shot.
    let sepFrame: number | null = null;
    for (const f of framesIn(r)) {
      const sep = wristSeparation(f);
      const sw = shoulderWidth(f);
      if (sep !== null && sw !== null && sep > sw) {
        sepFrame = f.frameIndex;
        break;
      }
    }
    release.guide_hand_duration =
      sepFrame !== null
        ? measure(normTime(sepFrame, startFrame, endFrame) - normTime(r.start, startFrame, endFrame), [r.start, sepFrame])
        : na("hands never clearly separate / not tracked");
    // Elbow height vs head: highest the shooting elbow gets relative to head.
    let elbowHigh: number | null = null;
    let elbowHighFrame = r.start;
    for (const f of framesIn(r)) {
      const h = heightAboveHead(f, arm.shooting.elbow);
      if (h !== null && (elbowHigh === null || h > elbowHigh)) {
        elbowHigh = h;
        elbowHighFrame = f.frameIndex;
      }
    }
    release.elbow_height_vs_head = elbowHigh !== null ? measure(elbowHigh, [elbowHighFrame]) : na("elbow/head not tracked");
    result.release = release;
  }

  // ---- Follow-through (range) --------------------------------------------
  if (phases.followThrough) {
    const r = phases.followThrough;
    const followThrough: Record<string, Measurement> = {};
    // Wrist snap: most-flexed wrist angle (min cock) after release.
    let snap: number | null = null;
    let snapFrame = r.start;
    let ext: number | null = null;
    let extFrame = r.start;
    for (const f of framesIn(r)) {
      const c = wristCockAngle(f, arm.shooting);
      if (c !== null && (snap === null || c < snap)) {
        snap = c;
        snapFrame = f.frameIndex;
      }
      const e = elbowAngle(f, arm.shooting);
      if (e !== null && (ext === null || e > ext)) {
        ext = e;
        extFrame = f.frameIndex;
      }
    }
    followThrough.wrist_snap_angle = snap !== null ? measure(snap, [snapFrame]) : na("wrist landmarks not tracked");
    followThrough.elbow_extension_angle = ext !== null ? measure(ext, [extFrame]) : na("elbow not tracked");
    result.followThrough = followThrough;
  }

  return result;
}

// ---- helpers ---------------------------------------------------------------

/** Adds `<name>_start` / `_end` / `_delta` for a per-frame scalar over a range. */
function addStartEndDelta(
  out: Record<string, Measurement>,
  name: string,
  getFrame: FrameLookup,
  r: FrameRange,
  fn: (f: Frame) => number | null,
): void {
  const s = ((f) => (f ? fn(f) : null))(getFrame(r.start));
  const e = ((f) => (f ? fn(f) : null))(getFrame(r.end));
  out[`${name}_start`] = s !== null ? measure(s, [r.start]) : unavailable("not tracked at phase start");
  out[`${name}_end`] = e !== null ? measure(e, [r.end]) : unavailable("not tracked at phase end");
  out[`${name}_delta`] =
    s !== null && e !== null
      ? measure(e - s, [r.start, r.end])
      : unavailable("not tracked across phase");
}

/**
 * Max perpendicular deviation (body-scaled) of the wrist from the straight line
 * between its first and last position in the phase — a proxy for how straight
 * the wrist rises. Signed toward/away from the body is left to scoring; here we
 * report the magnitude. Unavailable when the wrist isn't tracked.
 */
function wristPathDeviation(frames: Frame[], wristIndex: number): Measurement {
  const pts: { i: number; x: number; y: number }[] = [];
  for (const f of frames) {
    const w = pt(f, wristIndex);
    const scale = bodyScaleY(f);
    if (w && scale !== null) pts.push({ i: f.frameIndex, x: w.x / scale, y: w.y / scale });
  }
  if (pts.length < 3) return unavailable("wrist path not tracked");
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return unavailable("wrist path degenerate");
  let maxDev = 0;
  let devFrame = a.i;
  for (const p of pts) {
    // Perpendicular distance from point p to line a→b.
    const dev = Math.abs((dx * (a.y - p.y) - (a.x - p.x) * dy) / len);
    if (dev > maxDev) {
      maxDev = dev;
      devFrame = p.i;
    }
  }
  return measure(maxDev, [devFrame]);
}
