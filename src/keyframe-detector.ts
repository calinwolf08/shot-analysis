/**
 * Keyframe detection for basketball shot analysis.
 *
 * This module detects specific keyframes within a basketball shot,
 * starting with Load phase keyframes (leg_bend_low_point, ball_low_point).
 *
 * @see Feature 2.0 - Keyframe Detection Algorithms
 */

import type { Frame, TestLandmark, KeyframeId } from "./testing/types";
import { LANDMARK_INDICES, type Point3D } from "./types";

/**
 * Configuration for keyframe detection.
 */
export interface KeyframeDetectorConfig {
  /** Minimum visibility threshold for landmarks to be considered valid (0-1). Default: 0.5 */
  readonly visibilityThreshold?: number;
  /** Search window as percentage of shot duration for ball_low_point. Default: 0.4 (first 40%) */
  readonly ballLowPointSearchWindow?: number;
  /** Search window as percentage of shot duration for leg_bend_low_point. Default: 0.5 (first 50%) */
  readonly legBendSearchWindow?: number;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<KeyframeDetectorConfig> = {
  visibilityThreshold: 0.5,
  ballLowPointSearchWindow: 0.4,
  legBendSearchWindow: 0.5,
};

/**
 * Result of detecting a single keyframe.
 */
export interface DetectedKeyframe {
  /** The keyframe identifier */
  readonly keyframeId: KeyframeId;
  /** Detected frame index, or null if not detectable */
  readonly frameIndex: number | null;
  /** Confidence score for the detection (0-1) */
  readonly confidence: number;
}

/**
 * Result of keyframe detection for a shot.
 */
export interface KeyframeDetectionResult {
  /** All detected keyframes */
  readonly keyframes: readonly DetectedKeyframe[];
  /** Overall confidence for the detection */
  readonly confidence: number;
}

/**
 * Calculates the angle at the knee joint (hip-knee-ankle).
 *
 * The angle is measured at the knee vertex between the hip-knee vector
 * and knee-ankle vector. A straight leg is ~180 degrees, bent knee is less.
 *
 * @param hip - Hip landmark position
 * @param knee - Knee landmark position (vertex)
 * @param ankle - Ankle landmark position
 * @returns Angle in degrees (0-180). Returns null if any landmark is invalid.
 */
export function calculateKneeAngle(
  hip: TestLandmark | null,
  knee: TestLandmark | null,
  ankle: TestLandmark | null,
): number | null {
  if (!hip || !knee || !ankle) {
    return null;
  }

  // Convert to Point3D for calculation
  const hipPoint: Point3D = { x: hip.x, y: hip.y, z: hip.z };
  const kneePoint: Point3D = { x: knee.x, y: knee.y, z: knee.z };
  const anklePoint: Point3D = { x: ankle.x, y: ankle.y, z: ankle.z };

  // Calculate vectors from knee to hip and knee to ankle
  const vHip = {
    x: hipPoint.x - kneePoint.x,
    y: hipPoint.y - kneePoint.y,
    z: hipPoint.z - kneePoint.z,
  };

  const vAnkle = {
    x: anklePoint.x - kneePoint.x,
    y: anklePoint.y - kneePoint.y,
    z: anklePoint.z - kneePoint.z,
  };

  // Calculate magnitudes
  const magHip = Math.sqrt(vHip.x * vHip.x + vHip.y * vHip.y + vHip.z * vHip.z);
  const magAnkle = Math.sqrt(
    vAnkle.x * vAnkle.x + vAnkle.y * vAnkle.y + vAnkle.z * vAnkle.z,
  );

  // Handle degenerate case (identical points)
  if (magHip === 0 || magAnkle === 0) {
    return null;
  }

  // Calculate dot product
  const dotProduct = vHip.x * vAnkle.x + vHip.y * vAnkle.y + vHip.z * vAnkle.z;

  // Calculate cosine of the angle (clamp to handle floating point errors)
  const cosAngle = Math.max(-1, Math.min(1, dotProduct / (magHip * magAnkle)));

  // Convert to degrees
  const angleRadians = Math.acos(cosAngle);
  const angleDegrees = angleRadians * (180 / Math.PI);

  return angleDegrees;
}

/**
 * Gets the average knee angle for both legs in a frame.
 *
 * @param frame - The frame with pose landmarks
 * @param visibilityThreshold - Minimum visibility for landmarks to be valid
 * @returns Average knee angle, or single leg angle if one leg is not visible, or null if neither is valid
 */
function getFrameKneeAngle(
  frame: Frame,
  visibilityThreshold: number,
): number | null {
  if (!frame.landmarks) {
    return null;
  }

  const landmarks = frame.landmarks;

  // Get left leg landmarks
  const leftHip = landmarks[LANDMARK_INDICES.LEFT_HIP];
  const leftKnee = landmarks[LANDMARK_INDICES.LEFT_KNEE];
  const leftAnkle = landmarks[LANDMARK_INDICES.LEFT_ANKLE];

  // Get right leg landmarks
  const rightHip = landmarks[LANDMARK_INDICES.RIGHT_HIP];
  const rightKnee = landmarks[LANDMARK_INDICES.RIGHT_KNEE];
  const rightAnkle = landmarks[LANDMARK_INDICES.RIGHT_ANKLE];

  // Check visibility and calculate angles
  const leftVisible =
    leftHip &&
    leftKnee &&
    leftAnkle &&
    leftHip.visibility >= visibilityThreshold &&
    leftKnee.visibility >= visibilityThreshold &&
    leftAnkle.visibility >= visibilityThreshold;

  const rightVisible =
    rightHip &&
    rightKnee &&
    rightAnkle &&
    rightHip.visibility >= visibilityThreshold &&
    rightKnee.visibility >= visibilityThreshold &&
    rightAnkle.visibility >= visibilityThreshold;

  const leftAngle = leftVisible
    ? calculateKneeAngle(leftHip!, leftKnee!, leftAnkle!)
    : null;

  const rightAngle = rightVisible
    ? calculateKneeAngle(rightHip!, rightKnee!, rightAnkle!)
    : null;

  // Return average of both, or whichever is available
  if (leftAngle !== null && rightAngle !== null) {
    return (leftAngle + rightAngle) / 2;
  } else if (leftAngle !== null) {
    return leftAngle;
  } else if (rightAngle !== null) {
    return rightAngle;
  }

  return null;
}

/**
 * Gets the average wrist Y position for a frame.
 *
 * In normalized coordinates, Y=0 is top of frame, Y=1 is bottom.
 * So a "lower" ball position (in physical space) corresponds to a HIGHER Y value.
 *
 * @param frame - The frame with pose landmarks
 * @param visibilityThreshold - Minimum visibility for landmarks to be valid
 * @returns Average wrist Y, or single wrist Y if one is not visible, or null if neither is valid
 */
function getFrameWristY(
  frame: Frame,
  visibilityThreshold: number,
): number | null {
  if (!frame.landmarks) {
    return null;
  }

  const landmarks = frame.landmarks;

  const leftWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST];
  const rightWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];

  const leftVisible = leftWrist && leftWrist.visibility >= visibilityThreshold;
  const rightVisible =
    rightWrist && rightWrist.visibility >= visibilityThreshold;

  if (leftVisible && rightVisible) {
    return (leftWrist!.y + rightWrist!.y) / 2;
  } else if (leftVisible) {
    return leftWrist!.y;
  } else if (rightVisible) {
    return rightWrist!.y;
  }

  return null;
}

/**
 * Detects the frame with the deepest knee bend (minimum knee angle).
 *
 * This corresponds to the "leg_bend_low_point" keyframe in the Load phase.
 * The search is limited to the first portion of the shot (configurable).
 *
 * @param frames - Array of frames with pose data
 * @param startFrame - Shot start frame index (inclusive)
 * @param endFrame - Shot end frame index (inclusive)
 * @param config - Detection configuration
 * @returns Frame index of deepest bend, or null if not detectable
 */
export function detectLegBendLowPoint(
  frames: readonly Frame[],
  startFrame: number,
  endFrame: number,
  config: Required<KeyframeDetectorConfig> = DEFAULT_CONFIG,
): number | null {
  const shotDuration = endFrame - startFrame + 1;
  const searchEndFrame =
    startFrame + Math.floor(shotDuration * config.legBendSearchWindow);

  let minAngle = Infinity;
  let minAngleFrame: number | null = null;

  for (const frame of frames) {
    const frameIdx = frame.frameIndex;

    // Only search within the start to search window
    if (frameIdx < startFrame || frameIdx > searchEndFrame) {
      continue;
    }

    const kneeAngle = getFrameKneeAngle(frame, config.visibilityThreshold);

    if (kneeAngle !== null && kneeAngle < minAngle) {
      minAngle = kneeAngle;
      minAngleFrame = frameIdx;
    }
  }

  // Edge case: No clear dip - return frame closest to start if we found any valid frames
  if (minAngleFrame === null) {
    // Try to find any frame with valid landmarks near the start
    for (const frame of frames) {
      if (
        frame.frameIndex >= startFrame &&
        frame.frameIndex <= searchEndFrame
      ) {
        if (getFrameKneeAngle(frame, config.visibilityThreshold) !== null) {
          return frame.frameIndex;
        }
      }
    }
  }

  return minAngleFrame;
}

/**
 * Detects the frame with the lowest ball position (highest wrist Y).
 *
 * This corresponds to the "ball_low_point" keyframe in the Load phase.
 * The search is limited to the first portion of the shot (configurable).
 *
 * In normalized image coordinates, Y=0 is top, Y=1 is bottom.
 * So the "lowest" ball position has the MAXIMUM Y value.
 *
 * @param frames - Array of frames with pose data
 * @param startFrame - Shot start frame index (inclusive)
 * @param endFrame - Shot end frame index (inclusive)
 * @param config - Detection configuration
 * @returns Frame index of lowest ball position, or null if not detectable
 */
export function detectBallLowPoint(
  frames: readonly Frame[],
  startFrame: number,
  endFrame: number,
  config: Required<KeyframeDetectorConfig> = DEFAULT_CONFIG,
): number | null {
  const shotDuration = endFrame - startFrame + 1;
  const searchEndFrame =
    startFrame + Math.floor(shotDuration * config.ballLowPointSearchWindow);

  let maxWristY = -Infinity;
  let maxWristYFrame: number | null = null;

  for (const frame of frames) {
    const frameIdx = frame.frameIndex;

    // Only search within the start to search window
    if (frameIdx < startFrame || frameIdx > searchEndFrame) {
      continue;
    }

    const wristY = getFrameWristY(frame, config.visibilityThreshold);

    if (wristY !== null && wristY > maxWristY) {
      maxWristY = wristY;
      maxWristYFrame = frameIdx;
    }
  }

  // Edge case: No clear dip - return frame closest to start if we found any valid frames
  if (maxWristYFrame === null) {
    // Try to find any frame with valid landmarks near the start
    for (const frame of frames) {
      if (
        frame.frameIndex >= startFrame &&
        frame.frameIndex <= searchEndFrame
      ) {
        if (getFrameWristY(frame, config.visibilityThreshold) !== null) {
          return frame.frameIndex;
        }
      }
    }
  }

  return maxWristYFrame;
}

/**
 * KeyframeDetector class for detecting keyframes within basketball shots.
 *
 * Currently implements Load phase keyframe detection:
 * - leg_bend_low_point: Frame with deepest knee bend
 * - ball_low_point: Frame with lowest ball position (highest wrist Y)
 */
export class KeyframeDetector {
  private readonly config: Required<KeyframeDetectorConfig>;

  constructor(config: KeyframeDetectorConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Detects Load phase keyframes for a shot.
   *
   * @param frames - Array of frames with pose data
   * @param startFrame - Shot start frame index (inclusive)
   * @param endFrame - Shot end frame index (inclusive)
   * @returns Detection result with keyframes and confidence
   */
  detectLoadPhaseKeyframes(
    frames: readonly Frame[],
    startFrame: number,
    endFrame: number,
  ): KeyframeDetectionResult {
    const keyframes: DetectedKeyframe[] = [];

    // Detect leg_bend_low_point
    const legBendFrame = detectLegBendLowPoint(
      frames,
      startFrame,
      endFrame,
      this.config,
    );
    keyframes.push({
      keyframeId: "leg_bend_low_point",
      frameIndex: legBendFrame,
      confidence: legBendFrame !== null ? 0.8 : 0.0,
    });

    // Detect ball_low_point
    const ballLowFrame = detectBallLowPoint(
      frames,
      startFrame,
      endFrame,
      this.config,
    );
    keyframes.push({
      keyframeId: "ball_low_point",
      frameIndex: ballLowFrame,
      confidence: ballLowFrame !== null ? 0.8 : 0.0,
    });

    // Overall confidence based on successful detections
    const successCount = keyframes.filter((k) => k.frameIndex !== null).length;
    const overallConfidence = successCount / keyframes.length;

    return {
      keyframes,
      confidence: overallConfidence,
    };
  }

  /**
   * Get the current configuration.
   */
  getConfig(): Required<KeyframeDetectorConfig> {
    return { ...this.config };
  }
}

/**
 * Factory function to create a KeyframeDetector.
 *
 * @param config - Optional configuration overrides
 * @returns Configured KeyframeDetector instance
 */
export function createKeyframeDetector(
  config?: KeyframeDetectorConfig,
): KeyframeDetector {
  return new KeyframeDetector(config);
}
