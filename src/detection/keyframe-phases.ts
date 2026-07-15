/**
 * Bridges the keyframe algorithm (which matches the self-labeled data) to
 * the phase system the metric calculators consume.
 *
 * - `poseLandmarksToFrames` adapts the runtime pose format to the frame
 *   format the keyframe detectors expect.
 * - `phasesFromKeyframes` maps the detected keyframes to the 6 `ShotPhases`
 *   ranges. The arm-track and leg-track keyframes are detected
 *   independently, so a shooter whose ball reaches set point before the
 *   knees extend is segmented correctly (no coupled "rise = wrist-up +
 *   knee-extension" assumption).
 *
 * Only phases whose keyframes were detected are returned; the caller merges
 * these over the heuristic `phase-detector` output so any boundary the
 * keyframes don't yield (e.g. an occluded elbow in a behind view) still has
 * a value.
 */
import type { PoseLandmarks } from "../pose/types";
import type { Frame, KeyframeId } from "../testing/types";
import { ShotPhase, type PhaseRange, type ShotPhases } from "./types";

/** Adapt a runtime pose sequence to the keyframe detectors' frame format. */
export function poseLandmarksToFrames(
  sequence: readonly PoseLandmarks[],
): Frame[] {
  return sequence.map((pose, frameIndex) => ({
    frameIndex,
    // The keyframe detectors key off frameIndex, not wall time; a synthetic
    // timestamp keeps the Frame shape valid without needing real fps here.
    timestamp: frameIndex,
    poseConfidence: pose.poseConfidence,
    landmarks: pose.landmarks.map((l) => ({
      x: l.x,
      y: l.y,
      z: l.z,
      visibility: l.visibility,
    })),
  }));
}

/** A clamped, ordered range, or null when degenerate. */
function range(
  start: number | null | undefined,
  end: number | null | undefined,
  lo: number,
  hi: number,
): PhaseRange | null {
  if (start == null || end == null) return null;
  const s = Math.max(lo, Math.min(start, hi));
  const e = Math.max(lo, Math.min(end, hi));
  if (s > e) return null;
  return { startFrame: s, endFrame: e };
}

/**
 * Maps detected keyframes to the 6 phase ranges. Returns a partial set —
 * only phases whose keyframes were present.
 *
 *   Gather        start                → legs_start_bending − 1
 *   Load          legs_start_bending   → leg_bend_low_point ?? ball_low_point
 *   Rise          ball_starts_upward   → set_point − 1
 *   SetPoint      set_point            → set_point
 *   Release       set_point + 1        → arms_fully_extended ?? release
 *   FollowThrough (arms_fully_extended ?? release) + 1 → end
 */
export function phasesFromKeyframes(
  keyframes: ReadonlyMap<KeyframeId, number | null>,
  startFrame: number,
  endFrame: number,
): Partial<ShotPhases> {
  const kf = (id: KeyframeId): number | null => keyframes.get(id) ?? null;
  const lo = startFrame;
  const hi = endFrame;
  const phases: Partial<Record<ShotPhase, PhaseRange>> = {};

  const legsStartBending = kf("legs_start_bending");
  const loadEnd = kf("leg_bend_low_point") ?? kf("ball_low_point");
  const ballStartsUpward = kf("ball_starts_upward");
  const setPoint = kf("set_point");
  const release = kf("release");
  const armsExtended = kf("arms_fully_extended");
  const releaseEnd = armsExtended ?? release;

  const gather = range(startFrame, legsStartBending, lo, hi);
  // legs_start_bending is often the shot start → Gather degenerate; skip it.
  if (gather && legsStartBending != null && legsStartBending > startFrame) {
    phases[ShotPhase.Gather] = range(
      startFrame,
      legsStartBending - 1,
      lo,
      hi,
    ) as PhaseRange;
  }

  const load = range(legsStartBending, loadEnd, lo, hi);
  if (load) phases[ShotPhase.Load] = load;

  const rise = range(
    ballStartsUpward,
    setPoint != null ? setPoint - 1 : null,
    lo,
    hi,
  );
  if (rise) phases[ShotPhase.Rise] = rise;

  if (setPoint != null) {
    const sp = range(setPoint, setPoint, lo, hi);
    if (sp) phases[ShotPhase.SetPoint] = sp;
  }

  const rel = range(
    setPoint != null ? setPoint + 1 : release,
    releaseEnd,
    lo,
    hi,
  );
  if (rel) phases[ShotPhase.Release] = rel;

  // Follow-through starts after the (clamped) release range so the two can
  // never overlap, even when arms_fully_extended sits past the shot end.
  const ftStart = rel ? rel.endFrame + 1 : null;
  const ft = range(ftStart, endFrame, lo, hi);
  if (ft && ftStart != null && ftStart <= endFrame) {
    phases[ShotPhase.FollowThrough] = ft;
  }

  return phases as Partial<ShotPhases>;
}
