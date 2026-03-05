/**
 * Guide arm metric calculators for basketball shot analysis.
 *
 * This module provides calculators for measuring guide arm mechanics:
 * - guideElbowFlare: angle of guide elbow relative to body plane at set point
 * - guideHandPosition: position of guide hand relative to shooting hand (categorical)
 * - guideHandRelease: when guide hand separates from ball (% of shot)
 *
 * @see Feature 5.3 - Guide Arm Metrics
 */

import type {
  MetricCalculator,
  MetricCalculatorContext,
  MetricCalculatorResult,
  MetricValue,
} from "./types";
import { getHandednessMapping } from "../config";
import { calculateDistance } from "../utils/geometry";
import { ShotPhase } from "../detection/types";
import type { PoseLandmarks, PoseLandmark, Point3D } from "../types";
import { LANDMARK_INDICES } from "../types";

/**
 * Distance threshold for considering hands as "in contact" (normalized units).
 * Hand separation is detected when index fingers exceed this distance.
 */
const HAND_SEPARATION_THRESHOLD = 0.08;

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
 * @param shoulder - Shoulder position
 * @param elbow - Elbow position
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
  const dotProduct =
    shoulderToElbow.x * bodyNormal.x +
    shoulderToElbow.y * bodyNormal.y +
    shoulderToElbow.z * bodyNormal.z;

  // The angle between the arm and the body plane
  const sinAngle = Math.abs(dotProduct) / magnitude;

  // Clamp to valid range for asin
  const clampedSin = Math.max(-1, Math.min(1, sinAngle));

  // Convert to degrees
  const angleDegrees = Math.asin(clampedSin) * (180 / Math.PI);

  return angleDegrees;
}

/**
 * Guide hand position categories.
 */
export type GuideHandPositionCategory = "side" | "under" | "front" | "thumb-up";

/**
 * Calculator for guide elbow flare angle.
 *
 * Measures the angle of the guide elbow relative to the body plane
 * at the set point. A lower angle indicates the elbow is tucked in,
 * while a higher angle indicates the elbow is flared out.
 */
export class GuideElbowFlareCalculator implements MetricCalculator {
  readonly name = "guideElbowFlare";
  readonly description =
    "Angle of guide elbow relative to body plane at set point (degrees)";
  readonly unit = "degrees";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, config } = context;
    const mapping = getHandednessMapping(config.shootingHand);

    // Get set point phase (required)
    const setPointPhase = phases[ShotPhase.SetPoint];
    if (!setPointPhase) {
      return { error: "SetPoint phase not detected" };
    }

    // Get pose at set point frame
    const setPointPose = getPoseAtFrame(poseLandmarks, setPointPhase.startFrame);
    if (!setPointPose) {
      return { error: "Pose data missing for set point frame" };
    }

    // Get required landmarks for guide arm
    const guideShoulder =
      setPointPose.landmarks[mapping.guideShoulder] ?? null;
    const guideElbow = setPointPose.landmarks[mapping.guideElbow] ?? null;
    const shootingShoulder =
      setPointPose.landmarks[mapping.shootingShoulder] ?? null;
    const leftHip = setPointPose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
    const rightHip = setPointPose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;

    if (
      !guideShoulder ||
      !guideElbow ||
      !shootingShoulder ||
      !leftHip ||
      !rightHip
    ) {
      return { error: "Required landmarks missing" };
    }

    // Calculate confidence based on landmark visibility
    const confidence = calculateMinConfidence([
      guideShoulder,
      guideElbow,
      shootingShoulder,
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
      guideShoulder.position,
      guideElbow.position,
      bodyNormal,
    );

    const value: MetricValue = {
      value: Math.round(flareAngle * 10) / 10, // Round to 1 decimal
      unit: this.unit,
      frame: setPointPhase.startFrame,
      confidence,
    };

    return { value };
  }
}

/**
 * Calculator for guide hand position relative to shooting hand/ball.
 *
 * Classifies the position of the guide hand at set point into one of four
 * categories: 'side', 'under', 'front', or 'thumb-up'. This is determined
 * by the relative position of the guide wrist to the shooting wrist.
 */
export class GuideHandPositionCalculator implements MetricCalculator {
  readonly name = "guideHandPosition";
  readonly description =
    "Position of guide hand relative to ball/shooting hand at set point";
  readonly unit = "category";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, config } = context;
    const mapping = getHandednessMapping(config.shootingHand);

    // Get set point phase (required)
    const setPointPhase = phases[ShotPhase.SetPoint];
    if (!setPointPhase) {
      return { error: "SetPoint phase not detected" };
    }

    // Get pose at set point frame
    const setPointPose = getPoseAtFrame(poseLandmarks, setPointPhase.startFrame);
    if (!setPointPose) {
      return { error: "Pose data missing for set point frame" };
    }

    // Get required landmarks
    const guideWrist = setPointPose.landmarks[mapping.guideWrist] ?? null;
    const shootingWrist =
      setPointPose.landmarks[mapping.shootingWrist] ?? null;

    // Get guide index finger for thumb-up detection
    const guideIndexIdx =
      config.shootingHand === "right"
        ? LANDMARK_INDICES.LEFT_INDEX
        : LANDMARK_INDICES.RIGHT_INDEX;
    const guideIndex = setPointPose.landmarks[guideIndexIdx] ?? null;

    if (!guideWrist || !shootingWrist) {
      return { error: "Required wrist landmarks missing" };
    }

    // Calculate confidence
    const landmarks = [guideWrist, shootingWrist];
    if (guideIndex) landmarks.push(guideIndex);
    const confidence = calculateMinConfidence(landmarks);

    // Classify position based on relative positions
    const category = this.classifyPosition(
      guideWrist.position,
      shootingWrist.position,
      guideIndex?.position,
      config.shootingHand,
    );

    const value: MetricValue = {
      value: category,
      unit: this.unit,
      frame: setPointPhase.startFrame,
      confidence,
    };

    return { value };
  }

  /**
   * Classifies the guide hand position into a category.
   */
  private classifyPosition(
    guideWrist: Point3D,
    shootingWrist: Point3D,
    guideIndex: Point3D | undefined,
    shootingHand: "left" | "right",
  ): GuideHandPositionCategory {
    // Calculate relative positions
    const dx = guideWrist.x - shootingWrist.x;
    const dy = guideWrist.y - shootingWrist.y; // Positive = below (higher Y in image coords)
    const dz = guideWrist.z - shootingWrist.z; // Positive = forward

    // Check for thumb-up: index finger significantly above wrist
    if (guideIndex) {
      const indexAboveWrist = guideWrist.y - guideIndex.y; // Positive if index is above
      const indexHorizontalOffset = Math.abs(guideIndex.x - guideWrist.x);

      // Thumb-up: index finger above wrist with minimal horizontal offset
      if (indexAboveWrist > 0.05 && indexHorizontalOffset < 0.03) {
        return "thumb-up";
      }
    }

    // Check for front: significant Z difference
    if (Math.abs(dz) > 0.08) {
      return "front";
    }

    // Check for under: guide wrist below shooting wrist
    if (dy > 0.06) {
      return "under";
    }

    // Check for side: significant horizontal separation
    // For right-handed shooter, guide (left) should be to the left (negative dx)
    // For left-handed shooter, guide (right) should be to the right (positive dx)
    const expectedSideDirection = shootingHand === "right" ? -1 : 1;
    const horizontalOffset = dx * expectedSideDirection;

    if (horizontalOffset > 0.05) {
      return "side";
    }

    // Default to side if no clear classification
    return "side";
  }
}

/**
 * Calculator for guide hand release timing.
 *
 * Measures when the guide hand separates from the ball/shooting hand
 * as a percentage of the total shot duration. This is detected by
 * measuring the distance between index fingers and detecting when
 * it exceeds a threshold.
 */
export class GuideHandReleaseCalculator implements MetricCalculator {
  readonly name = "guideHandRelease";
  readonly description =
    "When guide hand releases from ball (% of shot duration)";
  readonly unit = "percent";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, config, frameRange } = context;

    // Get release phase (required to know the shot is valid)
    const releasePhase = phases[ShotPhase.Release];
    if (!releasePhase) {
      return { error: "Release phase not detected" };
    }

    // Get index finger landmark indices based on handedness
    const guideIndexIdx =
      config.shootingHand === "right"
        ? LANDMARK_INDICES.LEFT_INDEX
        : LANDMARK_INDICES.RIGHT_INDEX;
    const shootingIndexIdx =
      config.shootingHand === "right"
        ? LANDMARK_INDICES.RIGHT_INDEX
        : LANDMARK_INDICES.LEFT_INDEX;

    // Total shot duration in frames
    const totalShotDuration = frameRange.end - frameRange.start + 1;
    if (totalShotDuration <= 0) {
      return { error: "Invalid shot duration" };
    }

    // Find the frame where hands separate
    let separationFrame: number | null = null;
    let lastValidConfidence = 0;
    let wasInContact = false;

    for (
      let frameIndex = frameRange.start;
      frameIndex <= frameRange.end;
      frameIndex++
    ) {
      const pose = getPoseAtFrame(poseLandmarks, frameIndex);
      if (!pose) continue;

      const guideIndex = pose.landmarks[guideIndexIdx] ?? null;
      const shootingIndex = pose.landmarks[shootingIndexIdx] ?? null;

      if (!guideIndex || !shootingIndex) continue;

      const distance = calculateDistance(
        guideIndex.position,
        shootingIndex.position,
      );

      // Track if hands were ever in contact
      if (distance < HAND_SEPARATION_THRESHOLD) {
        wasInContact = true;
        lastValidConfidence = calculateMinConfidence([guideIndex, shootingIndex]);
      }

      // Detect separation: hands were in contact and now exceed threshold
      if (wasInContact && distance >= HAND_SEPARATION_THRESHOLD) {
        separationFrame = frameIndex;
        lastValidConfidence = calculateMinConfidence([guideIndex, shootingIndex]);
        break;
      }
    }

    // If no separation detected, check if we found any valid frames
    if (separationFrame === null) {
      if (!wasInContact && poseLandmarks.length === 0) {
        return { error: "No pose data available" };
      }
      // Hands stayed in contact through entire shot - return 100%
      const value: MetricValue = {
        value: 100,
        unit: this.unit,
        frame: frameRange.end,
        confidence: lastValidConfidence || 0.5,
      };
      return { value };
    }

    // Calculate percentage of shot duration
    const framesSinceStart = separationFrame - frameRange.start;
    const percentage = (framesSinceStart / totalShotDuration) * 100;

    const value: MetricValue = {
      value: Math.round(percentage * 10) / 10, // Round to 1 decimal
      unit: this.unit,
      frame: separationFrame,
      confidence: lastValidConfidence || 0.5, // Default to 0.5 if no valid frames
    };

    return { value };
  }
}

/**
 * Creates all guide arm calculators.
 * Convenience function for registering all calculators with the orchestrator.
 */
export function createGuideArmCalculators(): readonly MetricCalculator[] {
  return [
    new GuideElbowFlareCalculator(),
    new GuideHandPositionCalculator(),
    new GuideHandReleaseCalculator(),
  ] as const;
}
