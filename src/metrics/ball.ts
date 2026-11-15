/**
 * Ball position metric calculators for basketball shot analysis.
 *
 * This module provides calculators for measuring inferred ball position metrics:
 * - ballDip: how far ball drops before rising (normalized distance)
 * - ballPath: straightness of path to set point (deviation score)
 * - setPointHeight: height of set point relative to head (normalized)
 * - setPointDuration: how long ball stays at set point (ms)
 * - releasePoint: height/position at release (normalized coords)
 * - releaseAngle: angle of shooting arm at release (degrees)
 * - ballBehindHead: furthest back position relative to head (normalized)
 *
 * Ball center is inferred as midpoint of index fingers (landmarks 19, 20)
 * when hands are together. All distances normalized to shoulder width.
 * Heights relative to head (nose landmark 0).
 *
 * Note: Ball position tracking is only valid when hands are together.
 * After hands separate (release), ball cannot be tracked.
 * Ball metrics have lower confidence than body metrics.
 *
 * @see Feature 5.4 - Ball Position Metrics (Inferred)
 */

import type {
  MetricCalculator,
  MetricCalculatorContext,
  MetricCalculatorResult,
  MetricValue,
} from "./types";
import { getHandednessMapping } from "../config";
import { calculateAngle, calculateDistance } from "../utils/geometry";
import { ShotPhase } from "../detection/types";
import type { PoseLandmarks, Point3D } from "../types";
import { LANDMARK_INDICES } from "../types";

/**
 * Default threshold for determining if hands are "together" (holding ball).
 * Based on normalized distance between index fingers.
 */
const DEFAULT_HAND_TOGETHER_THRESHOLD = 0.08;

/**
 * Confidence penalty applied to ball metrics vs body metrics.
 * Ball position is inferred, so inherently less reliable.
 */
const BALL_CONFIDENCE_PENALTY = 0.8;

/**
 * Inferred ball position result.
 */
export interface InferredBallPosition {
  /** Inferred ball center position */
  readonly position: Point3D;
  /** Confidence score (0-1), based on index finger visibility */
  readonly confidence: number;
}

/**
 * Helper to get a pose at a specific frame index from the pose landmarks array.
 * Handles the case where frameIndex doesn't match array index.
 */
function getPoseAtFrame(
  poseLandmarks: readonly PoseLandmarks[],
  frameIndex: number,
): PoseLandmarks | undefined {
  // First try direct lookup assuming poseLandmarks is indexed by frame
  const directPose = poseLandmarks.find((p) => p.frameIndex === frameIndex);
  if (directPose) return directPose;

  // Fall back to array index if frame indices don't match
  const arrayIndex =
    frameIndex -
    (poseLandmarks.length > 0 ? (poseLandmarks[0]?.frameIndex ?? 0) : 0);
  if (arrayIndex >= 0 && arrayIndex < poseLandmarks.length) {
    return poseLandmarks[arrayIndex];
  }

  return undefined;
}

/**
 * Calculates shoulder width from a pose for normalization.
 */
function getShoulderWidth(pose: PoseLandmarks): number {
  const leftShoulder = pose.landmarks[LANDMARK_INDICES.LEFT_SHOULDER];
  const rightShoulder = pose.landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];

  if (!leftShoulder || !rightShoulder) {
    return 0.2; // Default fallback
  }

  return calculateDistance(leftShoulder.position, rightShoulder.position);
}

/**
 * Gets the nose (head reference) position from a pose.
 */
function getNosePosition(pose: PoseLandmarks): Point3D | null {
  const nose = pose.landmarks[LANDMARK_INDICES.NOSE];
  if (!nose) return null;
  return nose.position;
}

/**
 * Max per-frame movement of the shooting wrist relative to the shooting
 * shoulder (in shoulder-widths) for the ball to count as "held in place". Above
 * this the arm is moving the ball through space (rise or release).
 */
const SET_POINT_HOLD_MAX_VEL = 0.08;

/**
 * Position of the shooting wrist RELATIVE TO the shooting shoulder, normalized
 * by shoulder width — a point in the shooter's own body frame. It stays fixed
 * while the ball is held in the set pocket even as the legs extend and the
 * whole body translates up (both wrist and shoulder rise together); it changes
 * when the arm ROTATES the ball through space. So "this point frozen" ==
 * "ball held in place", which a bare elbow angle can't capture (a 90° elbow
 * can rotate up while the back lifts). Returns null when landmarks are missing.
 */
function wristShoulderRel(
  pose: PoseLandmarks,
  shoulderIdx: number,
  wristIdx: number,
  minVisibility = 0.2,
): { x: number; y: number } | null {
  const s = pose.landmarks[shoulderIdx];
  const w = pose.landmarks[wristIdx];
  if (!s || !w) return null;
  if (s.visibility < minVisibility || w.visibility < minVisibility) return null;
  // Normalize by the 2D shoulder width (image plane). The 3D distance includes
  // the noisy depth (z) estimate, which inflates and destabilizes the scale.
  const ls = pose.landmarks[LANDMARK_INDICES.LEFT_SHOULDER];
  const rs = pose.landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
  const scale =
    ls && rs
      ? Math.max(
          Math.hypot(ls.position.x - rs.position.x, ls.position.y - rs.position.y),
          0.05,
        )
      : 0.15;
  return {
    x: (w.position.x - s.position.x) / scale,
    y: (w.position.y - s.position.y) / scale,
  };
}

/** Elbow-joint angle (shoulder-elbow-wrist) for a given arm, or null. */
function armElbowAngle(
  pose: PoseLandmarks,
  shoulderIdx: number,
  elbowIdx: number,
  wristIdx: number,
  minVisibility = 0.2,
): number | null {
  const s = pose.landmarks[shoulderIdx];
  const e = pose.landmarks[elbowIdx];
  const w = pose.landmarks[wristIdx];
  if (!s || !e || !w) return null;
  if (
    s.visibility < minVisibility ||
    e.visibility < minVisibility ||
    w.visibility < minVisibility
  ) {
    return null;
  }
  return calculateAngle(s.position, e.position, w.position);
}

/**
 * Picks the "cocked" arm at the set point — the more flexed (smaller elbow
 * angle) of the two arms — and returns its landmark indices, so the hold can
 * be tracked on the same arm across frames. Handedness config is only a hint;
 * whichever arm is actually cocked wins.
 */
function pickCockedArm(
  pose: PoseLandmarks,
  config: MetricCalculatorContext["config"],
): { shoulder: number; elbow: number; wrist: number } | null {
  const m = getHandednessMapping(config.shootingHand);
  const arms = [
    { shoulder: m.shootingShoulder, elbow: m.shootingElbow, wrist: m.shootingWrist },
    { shoulder: m.guideShoulder, elbow: m.guideElbow, wrist: m.guideWrist },
  ];
  let best: { arm: (typeof arms)[number]; angle: number } | null = null;
  for (const arm of arms) {
    const a = armElbowAngle(pose, arm.shoulder, arm.elbow, arm.wrist);
    if (a === null) continue;
    if (best === null || a < best.angle) best = { arm, angle: a };
  }
  return best?.arm ?? null;
}

/**
 * Determines if hands are together (holding the ball).
 * Based on distance between index fingers.
 *
 * @param pose - The pose to check
 * @param threshold - Maximum distance for hands to be considered together (default: 0.08)
 * @returns true if hands are together, false otherwise
 */
export function areHandsTogether(
  pose: PoseLandmarks,
  threshold: number = DEFAULT_HAND_TOGETHER_THRESHOLD,
): boolean {
  const leftIndex = pose.landmarks[LANDMARK_INDICES.LEFT_INDEX];
  const rightIndex = pose.landmarks[LANDMARK_INDICES.RIGHT_INDEX];

  if (!leftIndex || !rightIndex) {
    return false;
  }

  const distance = calculateDistance(leftIndex.position, rightIndex.position);
  return distance < threshold;
}

/**
 * Infers the ball center position from index finger positions.
 * Ball center is the midpoint between left and right index fingers.
 *
 * @param pose - The pose to infer ball position from
 * @returns Inferred ball position with confidence, or null if hands are separated
 */
export function inferBallCenter(
  pose: PoseLandmarks,
): InferredBallPosition | null {
  const leftIndex = pose.landmarks[LANDMARK_INDICES.LEFT_INDEX];
  const rightIndex = pose.landmarks[LANDMARK_INDICES.RIGHT_INDEX];

  if (!leftIndex || !rightIndex) {
    return null;
  }

  // Check if hands are together
  if (!areHandsTogether(pose)) {
    return null;
  }

  // Calculate midpoint
  const position: Point3D = {
    x: (leftIndex.position.x + rightIndex.position.x) / 2,
    y: (leftIndex.position.y + rightIndex.position.y) / 2,
    z: (leftIndex.position.z + rightIndex.position.z) / 2,
  };

  // Confidence is minimum of the two finger visibilities, with penalty
  const confidence =
    Math.min(leftIndex.visibility, rightIndex.visibility) *
    BALL_CONFIDENCE_PENALTY;

  return { position, confidence };
}

/**
 * Calculator for ball dip distance.
 *
 * Measures how far the ball drops from its initial position before rising
 * to the set point. Normalized to shoulder width.
 * A dip of 0 means the ball only rises (no dip shooting style).
 */
export class BallDipCalculator implements MetricCalculator {
  readonly name = "ballDip";
  readonly description =
    "How far ball drops before rising to set point (normalized to shoulder width)";
  readonly unit = "normalized";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, frameRange } = context;

    // Find the range to analyze (gather through set point)
    const startFrame = frameRange.start;
    let endFrame = frameRange.end;

    // If we have set point, end there
    const setPointPhase = phases[ShotPhase.SetPoint];
    if (setPointPhase) {
      endFrame = setPointPhase.startFrame;
    }

    let initialY: number | null = null;
    let lowestY: number | null = null;
    let lowestFrame = startFrame;
    let totalConfidence = 0;
    let validFrames = 0;
    let shoulderWidth = 0.2;

    // Track ball position through the shot
    for (let frameIndex = startFrame; frameIndex <= endFrame; frameIndex++) {
      const pose = getPoseAtFrame(poseLandmarks, frameIndex);
      if (!pose) continue;

      const ballPos = inferBallCenter(pose);
      if (!ballPos) continue;

      // Get shoulder width for normalization on first valid frame
      if (validFrames === 0) {
        shoulderWidth = getShoulderWidth(pose);
      }

      if (initialY === null) {
        initialY = ballPos.position.y;
      }

      // Track lowest point (highest y value in image coords)
      if (lowestY === null || ballPos.position.y > lowestY) {
        lowestY = ballPos.position.y;
        lowestFrame = frameIndex;
      }

      totalConfidence += ballPos.confidence;
      validFrames++;
    }

    if (validFrames === 0 || initialY === null || lowestY === null) {
      // No valid ball tracking data
      const value: MetricValue = {
        value: 0,
        unit: this.unit,
        frame: startFrame,
        confidence: 0.5,
      };
      return { value };
    }

    // Calculate dip: how much ball dropped from initial position
    // In image coords, higher y = lower position, so dip = lowestY - initialY
    const dip = Math.max(0, lowestY - initialY);

    // Normalize to shoulder width
    const normalizedDip = dip / shoulderWidth;

    const avgConfidence = totalConfidence / validFrames;

    const value: MetricValue = {
      value: Math.round(normalizedDip * 100) / 100, // Round to 2 decimal places
      unit: this.unit,
      frame: lowestFrame,
      confidence: avgConfidence,
    };

    return { value };
  }
}

/**
 * Calculator for ball path straightness.
 *
 * Measures the deviation of the ball path from a straight line between
 * starting position and set point. A score of 0 means perfectly straight.
 */
export class BallPathCalculator implements MetricCalculator {
  readonly name = "ballPath";
  readonly description =
    "Straightness of ball path to set point (deviation score, 0 = straight)";
  readonly unit = "deviation";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, frameRange } = context;

    // Find the range to analyze
    const startFrame = frameRange.start;
    let endFrame = frameRange.end;

    const setPointPhase = phases[ShotPhase.SetPoint];
    if (setPointPhase) {
      endFrame = setPointPhase.startFrame;
    }

    // Collect ball positions
    const positions: { x: number; y: number; frame: number }[] = [];
    let totalConfidence = 0;
    let shoulderWidth = 0.2;

    for (let frameIndex = startFrame; frameIndex <= endFrame; frameIndex++) {
      const pose = getPoseAtFrame(poseLandmarks, frameIndex);
      if (!pose) continue;

      const ballPos = inferBallCenter(pose);
      if (!ballPos) continue;

      if (positions.length === 0) {
        shoulderWidth = getShoulderWidth(pose);
      }

      positions.push({
        x: ballPos.position.x,
        y: ballPos.position.y,
        frame: frameIndex,
      });
      totalConfidence += ballPos.confidence;
    }

    if (positions.length < 3) {
      // Need at least 3 points to measure deviation
      const value: MetricValue = {
        value: 0,
        unit: this.unit,
        frame: startFrame,
        confidence: 0.5,
      };
      return { value };
    }

    // Calculate deviation from straight line
    const startPos = positions[0]!;
    const endPos = positions[positions.length - 1]!;

    // Line from start to end
    const lineVecX = endPos.x - startPos.x;
    const lineVecY = endPos.y - startPos.y;
    const lineLength = Math.sqrt(lineVecX * lineVecX + lineVecY * lineVecY);

    if (lineLength === 0) {
      // Start and end at same position
      const value: MetricValue = {
        value: 0,
        unit: this.unit,
        frame: startFrame,
        confidence: totalConfidence / positions.length,
      };
      return { value };
    }

    // Calculate perpendicular distance of each point from the line
    let totalDeviation = 0;
    let maxDeviationFrame = startFrame;
    let maxDeviation = 0;

    for (let i = 1; i < positions.length - 1; i++) {
      const pos = positions[i]!;
      const toPointX = pos.x - startPos.x;
      const toPointY = pos.y - startPos.y;

      // Cross product gives perpendicular distance * lineLength
      const crossProduct = toPointX * lineVecY - toPointY * lineVecX;
      const perpDistance = Math.abs(crossProduct) / lineLength;

      totalDeviation += perpDistance;
      if (perpDistance > maxDeviation) {
        maxDeviation = perpDistance;
        maxDeviationFrame = pos.frame;
      }
    }

    // Average deviation, normalized to shoulder width
    const avgDeviation = totalDeviation / (positions.length - 2);
    const normalizedDeviation = avgDeviation / shoulderWidth;

    const avgConfidence = totalConfidence / positions.length;

    const value: MetricValue = {
      value: Math.round(normalizedDeviation * 1000) / 1000, // Round to 3 decimal places
      unit: this.unit,
      frame: maxDeviationFrame,
      confidence: avgConfidence,
    };

    return { value };
  }
}

/**
 * Calculator for set point height.
 *
 * Measures the height of the ball at set point relative to the head (nose).
 * Positive values mean above head, negative means below.
 * Normalized to shoulder width.
 */
export class SetPointHeightCalculator implements MetricCalculator {
  readonly name = "setPointHeight";
  readonly description =
    "Height of ball at set point relative to head (normalized to shoulder width)";
  readonly unit = "normalized";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases } = context;

    // Get set point phase
    const setPointPhase = phases[ShotPhase.SetPoint];
    if (!setPointPhase) {
      return { error: "SetPoint phase not detected" };
    }

    // Get pose at set point
    const pose = getPoseAtFrame(poseLandmarks, setPointPhase.startFrame);
    if (!pose) {
      return { error: "Pose data missing for set point frame" };
    }

    // Get ball position
    const ballPos = inferBallCenter(pose);

    // Get head (nose) position
    const nosePos = getNosePosition(pose);
    if (!nosePos) {
      return { error: "Nose landmark missing" };
    }

    // Get shoulder width for normalization
    const shoulderWidth = getShoulderWidth(pose);

    // If ball position can't be inferred (hands separated), use wrist position
    let ballY: number;
    let confidence: number;

    if (ballPos) {
      ballY = ballPos.position.y;
      confidence = ballPos.confidence;
    } else {
      // Fall back to shooting wrist position
      const mapping = getHandednessMapping(context.config.shootingHand);
      const wrist = pose.landmarks[mapping.shootingWrist];
      if (!wrist) {
        return {
          error:
            "Cannot infer ball position - hands separated and wrist missing",
        };
      }
      ballY = wrist.position.y;
      confidence = wrist.visibility * BALL_CONFIDENCE_PENALTY;
    }

    // Height relative to nose (negative y diff = ball above nose in image coords)
    const heightDiff = nosePos.y - ballY;
    const normalizedHeight = heightDiff / shoulderWidth;

    const value: MetricValue = {
      value: Math.round(normalizedHeight * 100) / 100,
      unit: this.unit,
      frame: setPointPhase.startFrame,
      confidence,
    };

    return { value };
  }
}

/**
 * Calculator for set point duration.
 *
 * Measures how long the ball stays at the set point in milliseconds.
 * Uses the duration of the SetPoint phase.
 */
export class SetPointDurationCalculator implements MetricCalculator {
  readonly name = "setPointDuration";
  readonly description = "Duration ball stays at set point (milliseconds)";
  readonly unit = "ms";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, config } = context;

    // Get set point phase
    const setPointPhase = phases[ShotPhase.SetPoint];
    if (!setPointPhase) {
      return { error: "SetPoint phase not detected" };
    }

    // Some shooters hold the set for several frames; others move continuously
    // through it. The SetPoint phase itself is a single frame, so we measure
    // the hold as the span the ball is kept "in place" — the shooting wrist
    // stationary RELATIVE TO the shooting shoulder (a point in the body frame).
    // This holds constant while the legs extend and the whole body rises (wrist
    // and shoulder rise together), but changes as soon as the arm rotates the
    // ball up into the release. Holding a 90° elbow while the back lifts is NOT
    // a hold — and, unlike a bare elbow angle, this catches that (the wrist
    // swings relative to the shoulder).
    const setFrame = setPointPhase.startFrame;
    const setPose = getPoseAtFrame(poseLandmarks, setFrame);
    const arm = setPose ? pickCockedArm(setPose, config) : null;

    let holdStart = setFrame;
    let holdEnd = setFrame;

    if (arm) {
      // Body-frame wrist position (x,y) per frame. NOT smoothed: smoothing the
      // position before differencing washes out the movement signal, making
      // everything look stationary. Velocity is computed raw; isolated jitter
      // is tolerated in the walk below.
      const relX = poseLandmarks.map(
        (p) => wristShoulderRel(p, arm.shoulder, arm.wrist)?.x ?? null,
      );
      const relY = poseLandmarks.map(
        (p) => wristShoulderRel(p, arm.shoulder, arm.wrist)?.y ?? null,
      );
      const setIdx = poseLandmarks.findIndex((p) => p.frameIndex === setFrame);

      // Per-frame movement of the body-frame wrist position (== how fast the
      // ball moves in the shooter's frame). Near zero while the ball is held.
      const vel = (i: number): number | null => {
        const x = relX[i];
        const y = relY[i];
        const px = relX[i - 1];
        const py = relY[i - 1];
        if (
          x === null ||
          x === undefined ||
          y === null ||
          y === undefined ||
          px === null ||
          px === undefined ||
          py === null ||
          py === undefined
        ) {
          return null;
        }
        return Math.hypot(x - px, y - py);
      };

      if (setIdx >= 0) {
        // The detected set point can sit at the edge of the pause (e.g. at the
        // deepest flex, just before the release push), so anchor to the least-
        // moving frame in a small window around it, then grow the stationary
        // (held-in-place) run outward.
        let anchor = setIdx;
        let bestVel = Infinity;
        for (let i = Math.max(1, setIdx - 5); i <= setIdx + 2; i++) {
          const v = vel(i);
          if (v !== null && v < bestVel) {
            bestVel = v;
            anchor = i;
          }
        }
        if (bestVel <= SET_POINT_HOLD_MAX_VEL) {
          holdStart = poseLandmarks[anchor]!.frameIndex;
          holdEnd = poseLandmarks[anchor]!.frameIndex;
          for (let i = anchor; i >= 1; i--) {
            const v = vel(i);
            if (v === null || v > SET_POINT_HOLD_MAX_VEL) break;
            holdStart = poseLandmarks[i - 1]!.frameIndex;
          }
          for (let i = anchor + 1; i < poseLandmarks.length; i++) {
            const v = vel(i);
            if (v === null || v > SET_POINT_HOLD_MAX_VEL) break;
            holdEnd = poseLandmarks[i]!.frameIndex;
          }
        } else {
          // No genuine pause — continuous shooter. Duration is ~1 frame.
          holdStart = setFrame;
          holdEnd = setFrame;
        }
      }
    }

    const durationFrames = holdEnd - holdStart + 1;

    // Convert to milliseconds using frame timestamps.
    let durationMs: number;
    const startPose = getPoseAtFrame(poseLandmarks, holdStart);
    const endPose = getPoseAtFrame(poseLandmarks, holdEnd);
    if (startPose && endPose && endPose.timestamp > startPose.timestamp) {
      durationMs = endPose.timestamp - startPose.timestamp;
    } else if (poseLandmarks.length >= 2) {
      const fps =
        1000 /
        Math.max(
          1,
          (poseLandmarks[1]?.timestamp ?? 33.33) -
            (poseLandmarks[0]?.timestamp ?? 0),
        );
      durationMs = (durationFrames / fps) * 1000;
    } else {
      durationMs = (durationFrames / 30) * 1000;
    }
    durationMs = Math.max(durationMs, (durationFrames / 30) * 1000);

    let confidence = 0.8;
    if (startPose && endPose) {
      confidence =
        Math.min(startPose.confidence, endPose.confidence) *
        BALL_CONFIDENCE_PENALTY;
    }

    const value: MetricValue = {
      value: Math.round(durationMs),
      unit: this.unit,
      frame: holdStart,
      confidence,
    };

    return { value };
  }
}

/**
 * Calculator for release point position.
 *
 * Measures the ball position at release relative to the head.
 * Returns the height (y position) normalized to shoulder width.
 */
export class ReleasePointCalculator implements MetricCalculator {
  readonly name = "releasePoint";
  readonly description =
    "Ball height at release point relative to head (normalized to shoulder width)";
  readonly unit = "normalized";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, config } = context;

    // Get release phase
    const releasePhase = phases[ShotPhase.Release];
    if (!releasePhase) {
      return { error: "Release phase not detected" };
    }

    // Get pose at release
    const pose = getPoseAtFrame(poseLandmarks, releasePhase.startFrame);
    if (!pose) {
      return { error: "Pose data missing for release frame" };
    }

    // Get head (nose) position
    const nosePos = getNosePosition(pose);
    if (!nosePos) {
      return { error: "Nose landmark missing" };
    }

    // Get shoulder width for normalization
    const shoulderWidth = getShoulderWidth(pose);

    // Try to get ball position, fall back to shooting wrist
    const ballPos = inferBallCenter(pose);
    let releaseY: number;
    let confidence: number;

    if (ballPos) {
      releaseY = ballPos.position.y;
      confidence = ballPos.confidence;
    } else {
      // Ball has likely left hand, use shooting wrist as proxy
      const mapping = getHandednessMapping(config.shootingHand);
      const wrist = pose.landmarks[mapping.shootingWrist];
      if (!wrist) {
        return { error: "Cannot determine release point - wrist missing" };
      }
      releaseY = wrist.position.y;
      confidence = wrist.visibility * BALL_CONFIDENCE_PENALTY;
    }

    // Height relative to nose (negative y diff = ball above nose)
    const heightDiff = nosePos.y - releaseY;
    const normalizedHeight = heightDiff / shoulderWidth;

    const value: MetricValue = {
      value: Math.round(normalizedHeight * 100) / 100,
      unit: this.unit,
      frame: releasePhase.startFrame,
      confidence,
    };

    return { value };
  }
}

/**
 * Calculator for release angle.
 *
 * Measures the angle of the shooting arm at release point.
 * The angle is measured from horizontal (0° = horizontal, 90° = straight up).
 */
export class ReleaseAngleCalculator implements MetricCalculator {
  readonly name = "releaseAngle";
  readonly description =
    "Angle of shooting arm at release point (degrees from horizontal)";
  readonly unit = "degrees";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, config } = context;
    const mapping = getHandednessMapping(config.shootingHand);

    // Get release phase
    const releasePhase = phases[ShotPhase.Release];
    if (!releasePhase) {
      return { error: "Release phase not detected" };
    }

    // Get pose at release
    const pose = getPoseAtFrame(poseLandmarks, releasePhase.startFrame);
    if (!pose) {
      return { error: "Pose data missing for release frame" };
    }

    // Get shooting arm landmarks
    const shoulder = pose.landmarks[mapping.shootingShoulder];
    const wrist = pose.landmarks[mapping.shootingWrist];

    if (!shoulder || !wrist) {
      return { error: "Required arm landmarks missing" };
    }

    // Calculate angle from horizontal
    // In image coords, y increases downward, so we need to flip
    const dx = wrist.position.x - shoulder.position.x;
    const dy = shoulder.position.y - wrist.position.y; // Flipped for correct angle

    // Angle from horizontal (positive = upward)
    let angleRadians = Math.atan2(dy, Math.abs(dx));
    let angleDegrees = angleRadians * (180 / Math.PI);

    // Ensure angle is positive (we care about upward direction)
    angleDegrees = Math.abs(angleDegrees);

    // Calculate confidence
    const confidence =
      Math.min(shoulder.visibility, wrist.visibility) * BALL_CONFIDENCE_PENALTY;

    const value: MetricValue = {
      value: Math.round(angleDegrees * 10) / 10,
      unit: this.unit,
      frame: releasePhase.startFrame,
      confidence,
    };

    return { value };
  }
}

/**
 * Calculator for ball behind head position.
 *
 * Measures the furthest back position of the ball relative to the head
 * during the shot. Normalized to shoulder width.
 * This indicates how far back the shooter brings the ball.
 */
export class BallBehindHeadCalculator implements MetricCalculator {
  readonly name = "ballBehindHead";
  readonly description =
    "Furthest back position of ball relative to head (normalized to shoulder width)";
  readonly unit = "normalized";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, frameRange, config } = context;

    // Analyze from gather through release
    const startFrame = frameRange.start;
    let endFrame = frameRange.end;

    const releasePhase = phases[ShotPhase.Release];
    if (releasePhase) {
      endFrame = releasePhase.startFrame;
    }

    // For right-handed shooter, ball is "behind" when x > nose x
    // For left-handed shooter, ball is "behind" when x < nose x
    const behindDirection = config.shootingHand === "right" ? 1 : -1;

    let maxBehindDistance = 0;
    let maxBehindFrame = startFrame;
    let totalConfidence = 0;
    let validFrames = 0;
    let shoulderWidth = 0.2;

    for (let frameIndex = startFrame; frameIndex <= endFrame; frameIndex++) {
      const pose = getPoseAtFrame(poseLandmarks, frameIndex);
      if (!pose) continue;

      const ballPos = inferBallCenter(pose);
      if (!ballPos) continue;

      const nosePos = getNosePosition(pose);
      if (!nosePos) continue;

      if (validFrames === 0) {
        shoulderWidth = getShoulderWidth(pose);
      }

      // Calculate how far behind the head the ball is
      const behindDistance = (ballPos.position.x - nosePos.x) * behindDirection;

      if (behindDistance > maxBehindDistance) {
        maxBehindDistance = behindDistance;
        maxBehindFrame = frameIndex;
      }

      totalConfidence += ballPos.confidence;
      validFrames++;
    }

    // Normalize to shoulder width
    const normalizedDistance = maxBehindDistance / shoulderWidth;

    // Clamp to 0 minimum (no negative "behind head" values)
    const clampedDistance = Math.max(0, normalizedDistance);

    const avgConfidence = validFrames > 0 ? totalConfidence / validFrames : 0.5;

    const value: MetricValue = {
      value: Math.round(clampedDistance * 100) / 100,
      unit: this.unit,
      frame: maxBehindFrame,
      confidence: avgConfidence,
    };

    return { value };
  }
}

/**
 * Creates all ball position metric calculators.
 * Convenience function for registering all calculators with the orchestrator.
 */
export function createBallMetricCalculators(): readonly MetricCalculator[] {
  return [
    new BallDipCalculator(),
    new BallPathCalculator(),
    new SetPointHeightCalculator(),
    new SetPointDurationCalculator(),
    new ReleasePointCalculator(),
    new ReleaseAngleCalculator(),
    new BallBehindHeadCalculator(),
  ] as const;
}
