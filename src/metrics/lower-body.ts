/**
 * Lower body metric calculators for basketball shot analysis.
 *
 * This module provides calculators for measuring lower body mechanics:
 * - hipDrop: how far hips drop in load phase (normalized to shoulder width)
 * - kneeFlexion: maximum knee bend angle at load (degrees, 180 = straight)
 * - legExtensionStart: when legs begin extending (% of total shot duration)
 *
 * @see Feature 5.5 - Lower Body Metrics
 */

import type {
  MetricCalculator,
  MetricCalculatorContext,
  MetricCalculatorResult,
  MetricValue,
} from "./types";
import { calculateAngle, calculateDistance } from "../utils/geometry";
import { ShotPhase } from "../detection/types";
import type { PoseLandmarks, PoseLandmark } from "../types";
import { LANDMARK_INDICES } from "../types";

/**
 * Minimum angle increase (degrees) to consider as "starting extension".
 * This threshold prevents noise from triggering false extension detection.
 */
const EXTENSION_ANGLE_THRESHOLD = 3;

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
 * Gets the average Y position of both hips.
 */
function getAverageHipY(
  leftHip: PoseLandmark,
  rightHip: PoseLandmark,
): number {
  return (leftHip.position.y + rightHip.position.y) / 2;
}

/**
 * Calculates shoulder width from shoulder landmarks.
 */
function getShoulderWidth(
  leftShoulder: PoseLandmark,
  rightShoulder: PoseLandmark,
): number {
  return calculateDistance(leftShoulder.position, rightShoulder.position);
}

/**
 * Calculates the average knee angle from both legs.
 * Knee angle is measured as hip-knee-ankle angle.
 */
function getAverageKneeAngle(
  leftHip: PoseLandmark,
  leftKnee: PoseLandmark,
  leftAnkle: PoseLandmark,
  rightHip: PoseLandmark,
  rightKnee: PoseLandmark,
  rightAnkle: PoseLandmark,
): number {
  const leftAngle = calculateAngle(
    leftHip.position,
    leftKnee.position,
    leftAnkle.position,
  );
  const rightAngle = calculateAngle(
    rightHip.position,
    rightKnee.position,
    rightAnkle.position,
  );
  return (leftAngle + rightAngle) / 2;
}

/**
 * Calculator for hip drop during load phase.
 *
 * Measures how far the hips drop from the initial standing position
 * to the lowest point in the load phase. The distance is normalized
 * to shoulder width to account for different camera distances.
 */
export class HipDropCalculator implements MetricCalculator {
  readonly name = "hipDrop";
  readonly description =
    "How far hips drop in load phase (normalized to shoulder width)";
  readonly unit = "ratio";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, frameRange } = context;

    // Get load phase (required)
    const loadPhase = phases[ShotPhase.Load];
    if (!loadPhase) {
      return { error: "Load phase not detected" };
    }

    // Find initial hip position (first frame of shot)
    const initialPose = getPoseAtFrame(poseLandmarks, frameRange.start);
    if (!initialPose) {
      return { error: "Pose data missing for initial frame" };
    }

    // Get initial hip landmarks
    const initialLeftHip =
      initialPose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
    const initialRightHip =
      initialPose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;
    const leftShoulder =
      initialPose.landmarks[LANDMARK_INDICES.LEFT_SHOULDER] ?? null;
    const rightShoulder =
      initialPose.landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] ?? null;

    if (
      !initialLeftHip ||
      !initialRightHip ||
      !leftShoulder ||
      !rightShoulder
    ) {
      return { error: "Required landmarks missing for initial frame" };
    }

    // Calculate shoulder width for normalization
    const shoulderWidth = getShoulderWidth(leftShoulder, rightShoulder);
    if (shoulderWidth === 0) {
      return { error: "Cannot calculate shoulder width" };
    }

    // Find lowest hip position during load phase
    let maxHipDrop = 0;
    let maxDropFrame = loadPhase.startFrame;
    let minConfidence = 1.0;
    let foundValidFrame = false;

    const initialHipY = getAverageHipY(initialLeftHip, initialRightHip);

    for (
      let frameIndex = loadPhase.startFrame;
      frameIndex <= loadPhase.endFrame;
      frameIndex++
    ) {
      const pose = getPoseAtFrame(poseLandmarks, frameIndex);
      if (!pose) continue;

      const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
      const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;

      if (!leftHip || !rightHip) continue;

      foundValidFrame = true;
      const confidence = calculateMinConfidence([leftHip, rightHip]);

      const currentHipY = getAverageHipY(leftHip, rightHip);
      // In image coordinates, Y increases downward, so drop is positive
      const hipDrop = currentHipY - initialHipY;

      if (hipDrop > maxHipDrop) {
        maxHipDrop = hipDrop;
        maxDropFrame = frameIndex;
        minConfidence = confidence;
      }
    }

    if (!foundValidFrame) {
      return { error: "No valid pose data in load phase" };
    }

    // Normalize by shoulder width
    const normalizedDrop = maxHipDrop / shoulderWidth;

    const value: MetricValue = {
      value: Math.round(normalizedDrop * 100) / 100, // Round to 2 decimals
      unit: this.unit,
      frame: maxDropFrame,
      confidence: minConfidence,
    };

    return { value };
  }
}

/**
 * Calculator for maximum knee flexion during load phase.
 *
 * Measures the minimum knee angle (maximum bend) achieved during the
 * load phase. Uses the hip-knee-ankle angle, where 180 degrees is
 * a straight leg and smaller angles indicate more bend.
 */
export class KneeFlexionCalculator implements MetricCalculator {
  readonly name = "kneeFlexion";
  readonly description =
    "Maximum knee bend angle at load phase (degrees, 180 = straight)";
  readonly unit = "degrees";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases } = context;

    // Get load phase (required)
    const loadPhase = phases[ShotPhase.Load];
    if (!loadPhase) {
      return { error: "Load phase not detected" };
    }

    // Find minimum knee angle (maximum flex) during load phase
    let minAngle = 180;
    let minAngleFrame = loadPhase.startFrame;
    let minConfidence = 1.0;
    let foundValidFrame = false;

    for (
      let frameIndex = loadPhase.startFrame;
      frameIndex <= loadPhase.endFrame;
      frameIndex++
    ) {
      const pose = getPoseAtFrame(poseLandmarks, frameIndex);
      if (!pose) continue;

      // Get leg landmarks
      const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
      const leftKnee = pose.landmarks[LANDMARK_INDICES.LEFT_KNEE] ?? null;
      const leftAnkle = pose.landmarks[LANDMARK_INDICES.LEFT_ANKLE] ?? null;
      const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;
      const rightKnee = pose.landmarks[LANDMARK_INDICES.RIGHT_KNEE] ?? null;
      const rightAnkle = pose.landmarks[LANDMARK_INDICES.RIGHT_ANKLE] ?? null;

      if (
        !leftHip ||
        !leftKnee ||
        !leftAnkle ||
        !rightHip ||
        !rightKnee ||
        !rightAnkle
      ) {
        continue;
      }

      foundValidFrame = true;

      const avgAngle = getAverageKneeAngle(
        leftHip,
        leftKnee,
        leftAnkle,
        rightHip,
        rightKnee,
        rightAnkle,
      );

      const confidence = calculateMinConfidence([
        leftHip,
        leftKnee,
        leftAnkle,
        rightHip,
        rightKnee,
        rightAnkle,
      ]);

      if (avgAngle <= minAngle) {
        minAngle = avgAngle;
        minAngleFrame = frameIndex;
        minConfidence = confidence;
      }
    }

    if (!foundValidFrame) {
      return { error: "No valid pose data in load phase" };
    }

    const value: MetricValue = {
      value: Math.round(minAngle * 10) / 10, // Round to 1 decimal
      unit: this.unit,
      frame: minAngleFrame,
      confidence: minConfidence,
    };

    return { value };
  }
}

/**
 * Calculator for leg extension start timing.
 *
 * Detects when the legs begin extending (knee angle starts increasing)
 * and reports this as a percentage of the total shot duration.
 * This indicates the timing of the explosive upward motion.
 */
export class LegExtensionStartCalculator implements MetricCalculator {
  readonly name = "legExtensionStart";
  readonly description =
    "When legs begin extending (% of shot duration)";
  readonly unit = "percent";

  calculate(context: MetricCalculatorContext): MetricCalculatorResult {
    const { poseLandmarks, phases, frameRange } = context;

    // Need rise or release phase to confirm shot progression
    const risePhase = phases[ShotPhase.Rise];
    const releasePhase = phases[ShotPhase.Release];

    if (!risePhase && !releasePhase) {
      return { error: "Rise or Release phase not detected" };
    }

    // Total shot duration
    const totalShotDuration = frameRange.end - frameRange.start + 1;
    if (totalShotDuration <= 0) {
      return { error: "Invalid shot duration" };
    }

    // Track knee angles across frames to detect when extension starts
    let previousAngle: number | null = null;
    let minAngleFrame = frameRange.start;
    let minAngle = 180;
    let minAngleConfidence = 0.5;
    let extensionStartFrame: number | null = null;
    let extensionConfidence = 0.5;

    // First pass: find the frame with minimum knee angle
    for (
      let frameIndex = frameRange.start;
      frameIndex <= frameRange.end;
      frameIndex++
    ) {
      const pose = getPoseAtFrame(poseLandmarks, frameIndex);
      if (!pose) continue;

      const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
      const leftKnee = pose.landmarks[LANDMARK_INDICES.LEFT_KNEE] ?? null;
      const leftAnkle = pose.landmarks[LANDMARK_INDICES.LEFT_ANKLE] ?? null;
      const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;
      const rightKnee = pose.landmarks[LANDMARK_INDICES.RIGHT_KNEE] ?? null;
      const rightAnkle = pose.landmarks[LANDMARK_INDICES.RIGHT_ANKLE] ?? null;

      if (
        !leftHip ||
        !leftKnee ||
        !leftAnkle ||
        !rightHip ||
        !rightKnee ||
        !rightAnkle
      ) {
        continue;
      }

      const avgAngle = getAverageKneeAngle(
        leftHip,
        leftKnee,
        leftAnkle,
        rightHip,
        rightKnee,
        rightAnkle,
      );

      const confidence = calculateMinConfidence([
        leftHip,
        leftKnee,
        leftAnkle,
        rightHip,
        rightKnee,
        rightAnkle,
      ]);

      if (avgAngle <= minAngle) {
        minAngle = avgAngle;
        minAngleFrame = frameIndex;
        minAngleConfidence = confidence;
      }
    }

    // Second pass: find when angle starts consistently increasing after minimum
    previousAngle = null;
    for (
      let frameIndex = minAngleFrame;
      frameIndex <= frameRange.end;
      frameIndex++
    ) {
      const pose = getPoseAtFrame(poseLandmarks, frameIndex);
      if (!pose) continue;

      const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
      const leftKnee = pose.landmarks[LANDMARK_INDICES.LEFT_KNEE] ?? null;
      const leftAnkle = pose.landmarks[LANDMARK_INDICES.LEFT_ANKLE] ?? null;
      const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;
      const rightKnee = pose.landmarks[LANDMARK_INDICES.RIGHT_KNEE] ?? null;
      const rightAnkle = pose.landmarks[LANDMARK_INDICES.RIGHT_ANKLE] ?? null;

      if (
        !leftHip ||
        !leftKnee ||
        !leftAnkle ||
        !rightHip ||
        !rightKnee ||
        !rightAnkle
      ) {
        continue;
      }

      const avgAngle = getAverageKneeAngle(
        leftHip,
        leftKnee,
        leftAnkle,
        rightHip,
        rightKnee,
        rightAnkle,
      );

      const confidence = calculateMinConfidence([
        leftHip,
        leftKnee,
        leftAnkle,
        rightHip,
        rightKnee,
        rightAnkle,
      ]);

      if (previousAngle !== null) {
        const angleIncrease = avgAngle - previousAngle;

        // Detect extension start when angle increases significantly
        if (angleIncrease >= EXTENSION_ANGLE_THRESHOLD) {
          extensionStartFrame = frameIndex;
          extensionConfidence = confidence;
          break;
        }
      }

      previousAngle = avgAngle;
    }

    // If no clear extension detected, use the frame after minimum bend
    if (extensionStartFrame === null) {
      extensionStartFrame = Math.min(minAngleFrame + 1, frameRange.end);
      extensionConfidence = minAngleConfidence;
    }

    // Calculate percentage
    const framesSinceStart = extensionStartFrame - frameRange.start;
    const percentage = (framesSinceStart / totalShotDuration) * 100;

    const value: MetricValue = {
      value: Math.round(percentage * 10) / 10, // Round to 1 decimal
      unit: this.unit,
      frame: extensionStartFrame,
      confidence: extensionConfidence,
    };

    return { value };
  }
}

/**
 * Creates all lower body calculators.
 * Convenience function for registering all calculators with the orchestrator.
 */
export function createLowerBodyCalculators(): readonly MetricCalculator[] {
  return [
    new HipDropCalculator(),
    new KneeFlexionCalculator(),
    new LegExtensionStartCalculator(),
  ] as const;
}
