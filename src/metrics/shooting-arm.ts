/**
 * Shooting arm metric calculators for basketball shot analysis.
 *
 * This module provides calculators for measuring shooting arm mechanics:
 * - shootingElbowFlare: angle of elbow relative to body plane
 * - shootingElbowAngle: bend angle at elbow at set point and release
 * - maxArmExtension: maximum elbow extension achieved
 * - wristSnapAngle: wrist flexion from set to release
 * - followThroughHold: duration arm stays extended
 *
 * @see Feature 5.2 - Shooting Arm Metrics
 */

import type {
  MetricCalculator,
  MetricCalculatorContext,
  MetricCalculatorResult,
  MetricValue,
} from "./types";
import { getHandednessMapping } from "../config";
import { calculateAngle } from "../utils/geometry";
import { ShotPhase } from "../detection/types";
import type { PoseLandmarks, PoseLandmark, Point3D } from "../types";
import { LANDMARK_INDICES } from "../types";

/**
 * Extension angle threshold (degrees) to consider arm as "extended".
 */
const ARM_EXTENDED_THRESHOLD = 160;

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
  // This handles cases where poseLandmarks is a slice starting from frame 0
  const arrayIndex =
    frameIndex -
    (poseLandmarks.length > 0 ? (poseLandmarks[0]?.frameIndex ?? 0) : 0);
  if (arrayIndex >= 0 && arrayIndex < poseLandmarks.length) {
    return poseLandmarks[arrayIndex];
  }

  return undefined;
}

/**
 * Calculates the minimum confidence from a set of landmarks.
 */
function calculateMinConfidence(landmarks: readonly PoseLandmark[]): number {
  if (landmarks.length === 0) return 0;
  return Math.min(...landmarks.map((l) => l.visibility));
}

/**
 * Calculates the body plane normal vector from shoulders and hips.
 * The body plane is defined by the frontal plane of the torso.
 *
 * @param leftShoulder - Left shoulder landmark
 * @param rightShoulder - Right shoulder landmark
 * @param leftHip - Left hip landmark
 * @param rightHip - Right hip landmark
 * @returns Normal vector to the body plane (pointing forward)
 */
function calculateBodyPlaneNormal(
  leftShoulder: Point3D,
  rightShoulder: Point3D,
  leftHip: Point3D,
  rightHip: Point3D,
): Point3D {
  // Calculate vectors across the body (shoulder to shoulder) and down (shoulder to hip)
  const shoulderVector = {
    x: rightShoulder.x - leftShoulder.x,
    y: rightShoulder.y - leftShoulder.y,
    z: rightShoulder.z - leftShoulder.z,
  };

  // Average hip position
  const midHip = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
    z: (leftHip.z + rightHip.z) / 2,
  };

  // Average shoulder position
  const midShoulder = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
    z: (leftShoulder.z + rightShoulder.z) / 2,
  };

  const verticalVector = {
    x: midHip.x - midShoulder.x,
    y: midHip.y - midShoulder.y,
    z: midHip.z - midShoulder.z,
  };

  // Cross product to get normal (points forward from body)
  const normal = {
    x:
      shoulderVector.y * verticalVector.z - shoulderVector.z * verticalVector.y,
    y:
      shoulderVector.z * verticalVector.x - shoulderVector.x * verticalVector.z,
    z:
      shoulderVector.x * verticalVector.y - shoulderVector.y * verticalVector.x,
  };

  // Normalize the vector
  const magnitude = Math.sqrt(
    normal.x * normal.x + normal.y * normal.y + normal.z * normal.z,
  );

  if (magnitude === 0) {
    return { x: 0, y: 0, z: 1 }; // Default forward direction
  }

  return {
    x: normal.x / magnitude,
    y: normal.y / magnitude,
    z: normal.z / magnitude,
  };
}

/**
 * Calculates the angle between the elbow and the body plane.
 * This measures how far the elbow "flares out" from the body.
 *
 * @param shoulder - Shooting shoulder position
 * @param elbow - Shooting elbow position
 * @param bodyNormal - Normal vector to body plane
 * @returns Angle in degrees (0 = elbow in plane, 90 = elbow perpendicular to plane)
 */
function calculateElbowFlareFromPlane(
  shoulder: Point3D,
  elbow: Point3D,
  bodyNormal: Point3D,
): number {
  // Vector from shoulder to elbow
  const shoulderToElbow = {
    x: elbow.x - shoulder.x,
    y: elbow.y - shoulder.y,
    z: elbow.z - shoulder.z,
  };

  const magnitude = Math.sqrt(
    shoulderToElbow.x * shoulderToElbow.x +
      shoulderToElbow.y * shoulderToElbow.y +
      shoulderToElbow.z * shoulderToElbow.z,
  );

  if (magnitude === 0) return 0;

  // Project shoulder-elbow vector onto body normal
  // The dot product gives us how much the elbow is in front of/behind the body plane
  const dotProduct =
    shoulderToElbow.x * bodyNormal.x +
    shoulderToElbow.y * bodyNormal.y +
    shoulderToElbow.z * bodyNormal.z;

  // The angle between the arm and the body plane
  // sin(angle) = (projection onto normal) / (arm length)
  const sinAngle = Math.abs(dotProduct) / magnitude;

  // Clamp to valid range for asin
  const clampedSin = Math.max(-1, Math.min(1, sinAngle));

  // Convert to degrees
  const angleDegrees = Math.asin(clampedSin) * (180 / Math.PI);

  return angleDegrees;
}

/**
 * Calculator for shooting elbow flare angle.
 *
 * Measures the angle of the shooting elbow relative to the body plane
 * at the release point. A lower angle indicates the elbow is tucked in
 * (better form), while a higher angle indicates the elbow is flared out.
 */
export class ShootingElbowFlareCalculator implements MetricCalculator {
  readonly name = "shootingElbowFlare";
  readonly description =
    "Angle of shooting elbow relative to body plane at release (degrees)";
  readonly unit = "degrees";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, config } = context;
    const mapping = getHandednessMapping(config.shootingHand);

    // Get release phase (required)
    const releasePhase = phases[ShotPhase.Release];
    if (!releasePhase) {
      return { error: "Release phase not detected" };
    }

    // Get pose at release frame
    const releasePose = getPoseAtFrame(poseLandmarks, releasePhase.startFrame);
    if (!releasePose) {
      return { error: "Pose data missing for release frame" };
    }

    // Get required landmarks
    const shootingShoulder =
      releasePose.landmarks[mapping.shootingShoulder] ?? null;
    const shootingElbow = releasePose.landmarks[mapping.shootingElbow] ?? null;
    const guideShoulder = releasePose.landmarks[mapping.guideShoulder] ?? null;
    const leftHip = releasePose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
    const rightHip = releasePose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;

    if (
      !shootingShoulder ||
      !shootingElbow ||
      !guideShoulder ||
      !leftHip ||
      !rightHip
    ) {
      return { error: "Required landmarks missing" };
    }

    // Calculate confidence based on landmark visibility
    const confidence = calculateMinConfidence([
      shootingShoulder,
      shootingElbow,
      guideShoulder,
      leftHip,
      rightHip,
    ]);

    // Calculate body plane normal
    const leftShoulder =
      config.shootingHand === "right" ? guideShoulder : shootingShoulder;
    const rightShoulder =
      config.shootingHand === "right" ? shootingShoulder : guideShoulder;

    const bodyNormal = calculateBodyPlaneNormal(
      leftShoulder.position,
      rightShoulder.position,
      leftHip.position,
      rightHip.position,
    );

    // Calculate elbow flare angle
    const flareAngle = calculateElbowFlareFromPlane(
      shootingShoulder.position,
      shootingElbow.position,
      bodyNormal,
    );

    const value: MetricValue = {
      value: Math.round(flareAngle * 10) / 10, // Round to 1 decimal
      unit: this.unit,
      frame: releasePhase.startFrame,
      confidence,
    };

    return { value };
  }
}

/**
 * Calculator for shooting elbow angle (bend).
 *
 * Measures the angle at the elbow vertex (shoulder-elbow-wrist) at the
 * set point. An angle of 180 means straight arm, 90 means 90-degree bend.
 */
export class ShootingElbowAngleCalculator implements MetricCalculator {
  readonly name = "shootingElbowAngle";
  readonly description =
    "Bend angle at elbow (shoulder-elbow-wrist) at set point (degrees)";
  readonly unit = "degrees";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, config } = context;
    const mapping = getHandednessMapping(config.shootingHand);

    // Get set point phase, fall back to release if missing
    let targetPhase = phases[ShotPhase.SetPoint];
    if (!targetPhase) {
      targetPhase = phases[ShotPhase.Release];
    }

    if (!targetPhase) {
      return { error: "SetPoint or Release phase not detected" };
    }

    // Get pose at target frame
    const pose = getPoseAtFrame(poseLandmarks, targetPhase.startFrame);
    if (!pose) {
      return { error: "Pose data missing for target frame" };
    }

    // Get arm landmarks
    const shoulder = pose.landmarks[mapping.shootingShoulder] ?? null;
    const elbow = pose.landmarks[mapping.shootingElbow] ?? null;
    const wrist = pose.landmarks[mapping.shootingWrist] ?? null;

    if (!shoulder || !elbow || !wrist) {
      return { error: "Required arm landmarks missing" };
    }

    // Calculate elbow angle using geometry utility
    const elbowAngle = calculateAngle(
      shoulder.position,
      elbow.position,
      wrist.position,
    );

    // Calculate confidence
    const confidence = calculateMinConfidence([shoulder, elbow, wrist]);

    const value: MetricValue = {
      value: Math.round(elbowAngle * 10) / 10,
      unit: this.unit,
      frame: targetPhase.startFrame,
      confidence,
    };

    return { value };
  }
}

/**
 * Calculator for maximum arm extension during follow-through.
 *
 * Finds the maximum elbow extension (straightest arm position) achieved
 * during the follow-through phase.
 */
export class MaxArmExtensionCalculator implements MetricCalculator {
  readonly name = "maxArmExtension";
  readonly description =
    "Maximum elbow extension achieved during follow-through (degrees)";
  readonly unit = "degrees";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, config } = context;
    const mapping = getHandednessMapping(config.shootingHand);

    // Get follow-through phase
    const followThroughPhase = phases[ShotPhase.FollowThrough];
    if (!followThroughPhase) {
      return { error: "FollowThrough phase not detected" };
    }

    let maxExtension = 0;
    let maxExtensionFrame = followThroughPhase.startFrame;
    let minConfidence = 1.0;
    let foundValidFrame = false;

    // Iterate through follow-through frames to find maximum extension
    for (
      let frameIndex = followThroughPhase.startFrame;
      frameIndex <= followThroughPhase.endFrame;
      frameIndex++
    ) {
      const pose = getPoseAtFrame(poseLandmarks, frameIndex);
      if (!pose) continue;

      const shoulder = pose.landmarks[mapping.shootingShoulder] ?? null;
      const elbow = pose.landmarks[mapping.shootingElbow] ?? null;
      const wrist = pose.landmarks[mapping.shootingWrist] ?? null;

      if (!shoulder || !elbow || !wrist) continue;

      const confidence = calculateMinConfidence([shoulder, elbow, wrist]);
      foundValidFrame = true;

      const elbowAngle = calculateAngle(
        shoulder.position,
        elbow.position,
        wrist.position,
      );

      if (elbowAngle > maxExtension) {
        maxExtension = elbowAngle;
        maxExtensionFrame = frameIndex;
        minConfidence = confidence;
      }
    }

    if (!foundValidFrame) {
      return { error: "No valid pose data in follow-through phase" };
    }

    const value: MetricValue = {
      value: Math.round(maxExtension * 10) / 10,
      unit: this.unit,
      frame: maxExtensionFrame,
      confidence: minConfidence,
    };

    return { value };
  }
}

/**
 * Calculator for wrist snap angle.
 *
 * Measures the change in wrist flexion angle from set point to release.
 * Uses the elbow-wrist-finger angle to track wrist movement.
 */
export class WristSnapAngleCalculator implements MetricCalculator {
  readonly name = "wristSnapAngle";
  readonly description =
    "Wrist flexion change from set point to release (degrees)";
  readonly unit = "degrees";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, config } = context;
    const mapping = getHandednessMapping(config.shootingHand);

    // Get both set point and release phases
    const setPointPhase = phases[ShotPhase.SetPoint];
    const releasePhase = phases[ShotPhase.Release];

    if (!setPointPhase && !releasePhase) {
      return { error: "Neither SetPoint nor Release phase detected" };
    }

    if (!releasePhase) {
      return { error: "Release phase not detected" };
    }

    // Use set point if available, otherwise use frame before release
    const setPointFrame = setPointPhase?.startFrame ?? releasePhase.startFrame;
    const releaseFrame = releasePhase.startFrame;

    const setPointPose = getPoseAtFrame(poseLandmarks, setPointFrame);
    const releasePose = getPoseAtFrame(poseLandmarks, releaseFrame);

    if (!setPointPose || !releasePose) {
      return { error: "Pose data missing for set point or release frame" };
    }

    // Get finger landmark index based on handedness
    const fingerIndex =
      config.shootingHand === "right"
        ? LANDMARK_INDICES.RIGHT_INDEX
        : LANDMARK_INDICES.LEFT_INDEX;

    // Get landmarks at set point
    const setPointElbow = setPointPose.landmarks[mapping.shootingElbow] ?? null;
    const setPointWrist = setPointPose.landmarks[mapping.shootingWrist] ?? null;
    const setPointFinger = setPointPose.landmarks[fingerIndex] ?? null;

    // Get landmarks at release
    const releaseElbow = releasePose.landmarks[mapping.shootingElbow] ?? null;
    const releaseWrist = releasePose.landmarks[mapping.shootingWrist] ?? null;
    const releaseFinger = releasePose.landmarks[fingerIndex] ?? null;

    if (
      !setPointElbow ||
      !setPointWrist ||
      !setPointFinger ||
      !releaseElbow ||
      !releaseWrist ||
      !releaseFinger
    ) {
      return { error: "Required landmarks missing for wrist snap calculation" };
    }

    // Calculate wrist angle at set point (elbow-wrist-finger)
    const setPointWristAngle = calculateAngle(
      setPointElbow.position,
      setPointWrist.position,
      setPointFinger.position,
    );

    // Calculate wrist angle at release
    const releaseWristAngle = calculateAngle(
      releaseElbow.position,
      releaseWrist.position,
      releaseFinger.position,
    );

    // Wrist snap is the change in angle
    const wristSnap = Math.abs(releaseWristAngle - setPointWristAngle);

    // Calculate confidence as minimum of all involved landmarks
    const confidence = calculateMinConfidence([
      setPointElbow,
      setPointWrist,
      setPointFinger,
      releaseElbow,
      releaseWrist,
      releaseFinger,
    ]);

    const value: MetricValue = {
      value: Math.round(wristSnap * 10) / 10,
      unit: this.unit,
      frame: releaseFrame,
      confidence,
    };

    return { value };
  }
}

/**
 * Calculator for follow-through hold duration.
 *
 * Measures how long the arm stays extended after release as a percentage
 * of the total shot duration. A longer hold indicates better follow-through.
 */
export class FollowThroughHoldCalculator implements MetricCalculator {
  readonly name = "followThroughHold";
  readonly description =
    "Duration arm stays extended during follow-through (% of shot)";
  readonly unit = "percent";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, config, frameRange } = context;
    const mapping = getHandednessMapping(config.shootingHand);

    // Get follow-through phase
    const followThroughPhase = phases[ShotPhase.FollowThrough];
    if (!followThroughPhase) {
      return { error: "FollowThrough phase not detected" };
    }

    // Total shot duration in frames
    const totalShotDuration = frameRange.end - frameRange.start + 1;
    if (totalShotDuration <= 0) {
      return { error: "Invalid shot duration" };
    }

    // Count frames where arm is extended
    let extendedFrameCount = 0;
    let totalConfidence = 0;
    let validFrameCount = 0;

    for (
      let frameIndex = followThroughPhase.startFrame;
      frameIndex <= followThroughPhase.endFrame;
      frameIndex++
    ) {
      const pose = getPoseAtFrame(poseLandmarks, frameIndex);
      if (!pose) continue;

      const shoulder = pose.landmarks[mapping.shootingShoulder] ?? null;
      const elbow = pose.landmarks[mapping.shootingElbow] ?? null;
      const wrist = pose.landmarks[mapping.shootingWrist] ?? null;

      if (!shoulder || !elbow || !wrist) continue;

      validFrameCount++;
      const confidence = calculateMinConfidence([shoulder, elbow, wrist]);
      totalConfidence += confidence;

      const elbowAngle = calculateAngle(
        shoulder.position,
        elbow.position,
        wrist.position,
      );

      // Consider arm "extended" if angle is above threshold
      if (elbowAngle >= ARM_EXTENDED_THRESHOLD) {
        extendedFrameCount++;
      }
    }

    // If no valid frames in follow-through, count the whole follow-through
    if (validFrameCount === 0) {
      // If we have no valid frames, assume follow-through is held
      const followThroughDuration =
        followThroughPhase.endFrame - followThroughPhase.startFrame + 1;
      const percentage = (followThroughDuration / totalShotDuration) * 100;

      const value: MetricValue = {
        value: Math.round(percentage * 10) / 10,
        unit: this.unit,
        frame: followThroughPhase.startFrame,
        confidence: 0.5, // Low confidence due to missing data
      };

      return { value };
    }

    // Calculate percentage of shot where arm is extended
    const holdPercentage = (extendedFrameCount / totalShotDuration) * 100;
    const avgConfidence = totalConfidence / validFrameCount;

    const value: MetricValue = {
      value: Math.round(holdPercentage * 10) / 10,
      unit: this.unit,
      frame: followThroughPhase.startFrame,
      confidence: avgConfidence,
    };

    return { value };
  }
}

/**
 * Creates all shooting arm calculators.
 * Convenience function for registering all calculators with the orchestrator.
 */
export function createShootingArmCalculators(): readonly MetricCalculator[] {
  return [
    new ShootingElbowFlareCalculator(),
    new ShootingElbowAngleCalculator(),
    new MaxArmExtensionCalculator(),
    new WristSnapAngleCalculator(),
    new FollowThroughHoldCalculator(),
  ] as const;
}
