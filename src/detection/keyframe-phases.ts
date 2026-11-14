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
import { createKeyframeDetector } from "../keyframe-detector";
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

/**
 * Frame-based keyframe orchestration (no PoseData coupling). This is the same
 * chained detection the offline harness scores against the labeled corpus, so
 * the runtime pipeline produces the same frames as the self-labeled data.
 *
 * The four sub-detectors run in dependency order: Load → Rise (needs the load
 * low points) → SetPoint/Release (needs ball-starts-upward) → FollowThrough
 * (needs release). A missing upstream keyframe nulls the dependent track
 * rather than guessing.
 *
 * @param frames - Pose frames for the whole clip
 * @param startFrame - Shot start frame index (inclusive)
 * @param endFrame - Shot end frame index (inclusive)
 * @returns Map of keyframe IDs to detected frame numbers (or null)
 */
export function detectKeyframesFromFrames(
  frames: readonly Frame[],
  startFrame: number,
  endFrame: number,
): Map<KeyframeId, number | null> {
  const keyframeDetector = createKeyframeDetector();
  const detectedKeyframes = new Map<KeyframeId, number | null>();

  // Phase 1: Load phase keyframes
  const loadResult = keyframeDetector.detectLoadPhaseKeyframes(
    frames,
    startFrame,
    endFrame,
  );

  // Extract leg_bend_low_point and ball_low_point from Load phase
  let legBendLowPointFrame: number | null = null;
  let ballLowPointFrame: number | null = null;

  for (const kf of loadResult.keyframes) {
    detectedKeyframes.set(kf.keyframeId, kf.frameIndex);
    if (kf.keyframeId === "leg_bend_low_point") {
      legBendLowPointFrame = kf.frameIndex;
    }
    if (kf.keyframeId === "ball_low_point") {
      ballLowPointFrame = kf.frameIndex;
    }
  }

  // Phase 2: Rise phase keyframes (depends on Load phase)
  let ballStartsUpwardFrame: number | null = null;

  if (legBendLowPointFrame !== null && ballLowPointFrame !== null) {
    const riseResult = keyframeDetector.detectRisePhaseKeyframes(
      frames,
      legBendLowPointFrame,
      ballLowPointFrame,
      endFrame,
    );

    for (const kf of riseResult.keyframes) {
      detectedKeyframes.set(kf.keyframeId, kf.frameIndex);
      if (kf.keyframeId === "ball_starts_upward") {
        ballStartsUpwardFrame = kf.frameIndex;
      }
    }
  } else {
    // Cannot detect Rise phase without Load phase
    detectedKeyframes.set("legs_start_extending", null);
    detectedKeyframes.set("legs_fully_extended", null);
    detectedKeyframes.set("ball_starts_upward", null);
  }

  // Phase 3: Set Point and Release (depends on Rise phase)
  let releaseFrame: number | null = null;

  if (ballStartsUpwardFrame !== null) {
    const setPointReleaseResult =
      keyframeDetector.detectSetPointReleaseKeyframes(
        frames,
        ballStartsUpwardFrame,
        endFrame,
      );

    for (const kf of setPointReleaseResult.keyframes) {
      detectedKeyframes.set(kf.keyframeId, kf.frameIndex);
      if (kf.keyframeId === "release") {
        releaseFrame = kf.frameIndex;
      }
    }
  } else {
    // Cannot detect Set Point/Release without Rise phase
    detectedKeyframes.set("set_point", null);
    detectedKeyframes.set("release", null);
  }

  // Phase 4: Follow-through (depends on Release)
  if (releaseFrame !== null) {
    const followThroughResult = keyframeDetector.detectFollowThroughKeyframes(
      frames,
      releaseFrame,
      startFrame,
      endFrame,
    );

    for (const kf of followThroughResult.keyframes) {
      detectedKeyframes.set(kf.keyframeId, kf.frameIndex);
    }
  } else {
    // Cannot detect Follow-through without Release
    detectedKeyframes.set("arms_fully_extended", null);
    detectedKeyframes.set("feet_leave_ground", null);
    detectedKeyframes.set("feet_land", null);
  }

  // legs_start_bending marks where the shooting motion begins; the labels use
  // the shot start for this, so we mirror that.
  detectedKeyframes.set("legs_start_bending", startFrame);

  return detectedKeyframes;
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
