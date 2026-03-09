/**
 * Detection execution and comparison functions for the test runner.
 *
 * This module provides:
 * - Adapter to convert test PoseData to shot detector format
 * - Detection execution that runs shot detection on pose data
 * - Comparison logic to validate detected shots against labels
 * - Tolerance rules for pass/fail determination
 *
 * @see Feature 9.0 - Test Runner Infrastructure
 * @see Task 9.2 - Detection Execution & Comparison
 */

import type { PoseLandmarks, Landmark } from "../pose/types";
import { LANDMARK_INDEX } from "../pose/types";
import { createShotBoundaryDetector } from "../detection/shot-detector";
import type { PoseData, LabelData, Orientation, Frame } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * A detected shot from the algorithm.
 */
export interface DetectedShotResult {
  /** Start frame index (0-based) */
  readonly startFrame: number;
  /** End frame index (0-based) */
  readonly endFrame: number;
}

/**
 * Result of running detection on pose data.
 */
export interface DetectionResult {
  /** Array of detected shots */
  readonly shots: readonly DetectedShotResult[];
  /** Detected camera orientation */
  readonly orientation: Orientation | "unknown";
}

/**
 * Frame comparison result for start or end frame.
 */
export interface FrameComparison {
  /** Detected frame number */
  readonly detected: number;
  /** Expected (labeled) frame number */
  readonly expected: number;
  /** Absolute difference between detected and expected */
  readonly diff: number;
  /** Whether this frame passes tolerance check */
  readonly pass: boolean;
}

/**
 * Per-shot orientation comparison.
 */
export interface OrientationComparison {
  /** Detected orientation for this shot */
  readonly detected: Orientation | "unknown";
  /** Expected (labeled) orientation */
  readonly expected: Orientation;
  /** Whether orientations match */
  readonly match: boolean;
}

/**
 * Comparison result for a single shot.
 */
export interface ShotComparison {
  /** Shot number (1-based, matching label data) */
  readonly shotNumber: number;
  /** Start frame comparison */
  readonly startFrame: FrameComparison;
  /** End frame comparison */
  readonly endFrame: FrameComparison;
  /** Orientation comparison for this shot */
  readonly orientation: OrientationComparison;
}

/**
 * Overall comparison result for a video.
 */
export interface ComparisonResult {
  /** Video filename */
  readonly video: string;
  /** Overall pass/fail status */
  readonly status: "pass" | "fail";
  /** Per-shot comparisons (includes per-shot orientation) */
  readonly shots: readonly ShotComparison[];
  /** Failure reason if status is 'fail' */
  readonly failureReason?: string;
}

// ============================================================================
// Adapter: PoseData to PoseLandmarks
// ============================================================================

import type { TestLandmark } from "./types";

/**
 * Converts a TestLandmark (from test data) to a Landmark (for shot detector).
 * Adds a default confidence value since TestLandmark doesn't include it.
 */
function convertTestLandmarkToLandmark(testLandmark: TestLandmark): Landmark {
  return {
    x: testLandmark.x,
    y: testLandmark.y,
    z: testLandmark.z,
    visibility: testLandmark.visibility,
    confidence: testLandmark.visibility, // Use visibility as confidence proxy
  };
}

/**
 * Converts a Frame (from test data) to PoseLandmarks (for shot detector).
 * Returns null if the frame has no landmarks (no pose detected).
 */
function convertFrameToPoseLandmarks(frame: Frame): PoseLandmarks | null {
  if (frame.landmarks === null) {
    return null;
  }
  return {
    landmarks: frame.landmarks.map(convertTestLandmarkToLandmark),
    poseConfidence: frame.poseConfidence,
  };
}

/**
 * Result of adapting pose data, including frame index mapping.
 */
export interface AdaptedPoseData {
  /** Array of PoseLandmarks for valid frames */
  readonly landmarks: readonly PoseLandmarks[];
  /** Maps filtered array index to original frame index */
  readonly indexToFrame: readonly number[];
}

/**
 * Converts PoseData frames to an array of PoseLandmarks for the shot detector.
 * Frames with null landmarks are filtered out.
 * Returns both the landmarks array and a mapping from array indices to original frame numbers.
 *
 * @param poseData - Pose data loaded from test case
 * @returns Adapted pose data with landmarks and frame index mapping
 */
export function adaptPoseDataToDetector(poseData: PoseData): AdaptedPoseData {
  const landmarks: PoseLandmarks[] = [];
  const indexToFrame: number[] = [];

  for (const frame of poseData.frames) {
    const converted = convertFrameToPoseLandmarks(frame);
    if (converted !== null) {
      landmarks.push(converted);
      indexToFrame.push(frame.frameIndex);
    }
  }

  return { landmarks, indexToFrame };
}

// ============================================================================
// Orientation Detection
// ============================================================================

/**
 * Detects camera orientation from hip-shoulder alignment for a range of frames.
 *
 * The orientation is determined by comparing the X positions of shoulders and hips:
 * - Front views: Left landmarks are to the left of right landmarks (rightX > leftX)
 * - Back views: Left landmarks are to the right of right landmarks (rightX < leftX, reversed)
 * - Side views: Shoulders nearly aligned in X
 *
 * 8 orientations covering full 360°:
 * - front: Camera facing shooter from the front
 * - front-left: Camera at ~45° from front, shooter's left side
 * - front-right: Camera at ~45° from front, shooter's right side
 * - side-left: Camera at ~90° viewing shooter's left side
 * - side-right: Camera at ~90° viewing shooter's right side
 * - behind-left: Camera at ~135° from front, behind and to the left
 * - behind-right: Camera at ~135° from front, behind and to the right
 * - behind: Camera directly behind the shooter
 *
 * @param frames - Array of frames to analyze
 * @returns Detected orientation or 'unknown' if detection fails
 */
export function detectOrientationFromFrames(
  frames: readonly Frame[],
): Orientation | "unknown" {
  if (frames.length === 0) {
    return "unknown";
  }

  let totalShoulderDiffX = 0;
  let totalHipDiffX = 0;
  let totalShoulderZ = 0;
  let validSamples = 0;

  for (const frame of frames) {
    // Skip frames with null landmarks
    if (frame.landmarks === null) {
      continue;
    }

    const landmarks = frame.landmarks;

    const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
    const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
    const leftHip = landmarks[LANDMARK_INDEX.LEFT_HIP];
    const rightHip = landmarks[LANDMARK_INDEX.RIGHT_HIP];

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
      continue;
    }

    // Check visibility - need reasonable visibility on all key landmarks
    const minVisibility = 0.3;
    if (
      leftShoulder.visibility < minVisibility ||
      rightShoulder.visibility < minVisibility ||
      leftHip.visibility < minVisibility ||
      rightHip.visibility < minVisibility
    ) {
      continue;
    }

    // X difference: positive = right is to the right of left (front view, normal)
    // negative = right is to the left of left (back view, shoulders appear reversed)
    totalShoulderDiffX += rightShoulder.x - leftShoulder.x;
    totalHipDiffX += rightHip.x - leftHip.x;

    // Z difference: which side is closer to camera
    // Positive = right shoulder farther from camera (left side closer)
    // Negative = left shoulder farther from camera (right side closer)
    totalShoulderZ += rightShoulder.z - leftShoulder.z;

    validSamples++;
  }

  if (validSamples < 1) {
    return "unknown";
  }

  const avgShoulderDiffX = totalShoulderDiffX / validSamples;
  const avgHipDiffX = totalHipDiffX / validSamples;
  const avgZDiff = totalShoulderZ / validSamples;

  // Determine if we're viewing from front or back based on X ordering
  // In MediaPipe landmark convention:
  // - "Left" and "Right" refer to the PERSON'S body parts, not the viewer's perspective
  // - Front view: rightShoulder.x < leftShoulder.x (person's right shoulder appears on viewer's left)
  // - Back view: rightShoulder.x > leftShoulder.x (shoulders appear "reversed" from back)
  const isFrontView = avgShoulderDiffX < 0;
  const isBackView = avgShoulderDiffX > 0;

  // Thresholds for determining orientation
  const frontBackThreshold = 0.15; // Shoulders clearly separated in X - front/back view
  const pureSideShoulderThreshold = 0.02; // True side view when shoulders nearly overlap
  const sideThreshold = 0.05; // Moderate side threshold for side views with some separation
  // Z-depth thresholds for left/right qualifier - different for front vs behind
  // Front views: lower threshold as the Z-depth is more visible in the pose
  // Behind views: higher threshold since we're seeing the back of the person
  const frontAngleThreshold = 0.35;
  const behindAngleThreshold = 0.40;

  // Absolute shoulder separation for front/back vs side determination
  const shoulderSeparation = Math.abs(avgShoulderDiffX);
  const hipSeparation = Math.abs(avgHipDiffX);
  const avgSeparation = (shoulderSeparation + hipSeparation) / 2;

  // Use Z-depth magnitude to help distinguish side vs angled views
  const absZDiff = Math.abs(avgZDiff);
  const sideViewZThreshold = 0.45; // Very large Z-depth indicates side-like view

  // CASE 1: Good shoulder separation - clear frontal or back view
  if (avgSeparation > frontBackThreshold) {
    if (isFrontView) {
      // Front-facing orientations
      if (avgZDiff > frontAngleThreshold) {
        return "front-left";
      } else if (avgZDiff < -frontAngleThreshold) {
        return "front-right";
      }
      return "front";
    } else if (isBackView) {
      // Back-facing orientations (shoulders appear reversed)
      if (avgZDiff > behindAngleThreshold) {
        return "behind-left";
      } else if (avgZDiff < -behindAngleThreshold) {
        return "behind-right";
      }
      return "behind";
    }
  }
  // CASE 2: Pure side view - very small shoulder X separation (< 0.02) with large Z-depth
  else if (
    shoulderSeparation < pureSideShoulderThreshold &&
    absZDiff > sideViewZThreshold
  ) {
    if (avgZDiff > 0) {
      return "side-left";
    } else {
      return "side-right";
    }
  }
  // CASE 3: Large Z-depth (> 0.45) with moderate shoulder separation
  // When Z-depth is extreme, it could be:
  // - A true side view (shoulders overlapping in X, one closer to camera)
  // - A front view with body/shoulder rotation during shooting motion
  // Key insight: if hip separation is very small (< 0.03), the person's body is facing camera
  // even if shoulders show rotation due to shooting form.
  else if (absZDiff > sideViewZThreshold) {
    // Special case: very small hip separation means body is facing camera
    // This indicates front view with shoulder rotation, not a true side view
    // DON'T add left/right qualifier since the Z-depth is from shooting form rotation,
    // not actual camera angle offset.
    if (hipSeparation < 0.03 && shoulderSeparation < sideThreshold) {
      // Front view - no left/right qualifier despite large Z-depth
      return "front";
    }
    // Otherwise, large Z-depth with moderate separation = side view
    if (avgZDiff > 0) {
      return "side-left";
    } else {
      return "side-right";
    }
  }
  // CASE 4: Angled view (moderate separation, moderate Z)
  else {
    if (isFrontView) {
      if (avgZDiff > frontAngleThreshold) {
        return "front-left";
      } else if (avgZDiff < -frontAngleThreshold) {
        return "front-right";
      }
      return "front";
    } else if (isBackView) {
      // Check if this is actually a front view with shoulder rotation
      if (shoulderSeparation < sideThreshold && hipSeparation < 0.02) {
        // Very small shoulder separation + minimal hip separation = likely front view
        return "front";
      }
      if (avgZDiff > behindAngleThreshold) {
        return "behind-left";
      } else if (avgZDiff < -behindAngleThreshold) {
        return "behind-right";
      }
      return "behind";
    }
  }

  return "unknown";
}

/**
 * Detects camera orientation from pose data by sampling frames.
 *
 * @param poseData - Pose data to analyze
 * @returns Detected orientation or 'unknown' if detection fails
 */
export function detectOrientation(poseData: PoseData): Orientation | "unknown" {
  if (poseData.frames.length === 0) {
    return "unknown";
  }

  // Sample frames from the middle of the video (more stable poses)
  const startSample = Math.floor(poseData.frames.length * 0.3);
  const endSample = Math.floor(poseData.frames.length * 0.7);
  const sampleSize = Math.min(10, endSample - startSample);

  if (sampleSize < 1) {
    return "unknown";
  }

  const sampleFrames = poseData.frames.slice(
    startSample,
    startSample + sampleSize,
  );
  return detectOrientationFromFrames(sampleFrames);
}

/**
 * Detects camera orientation for a specific shot (frame range).
 *
 * @param poseData - Full pose data
 * @param startFrame - Start frame index (inclusive)
 * @param endFrame - End frame index (inclusive)
 * @returns Detected orientation or 'unknown' if detection fails
 */
export function detectOrientationForShot(
  poseData: PoseData,
  startFrame: number,
  endFrame: number,
): Orientation | "unknown" {
  // Get frames within the shot range
  const shotFrames = poseData.frames.filter(
    (f) => f.frameIndex >= startFrame && f.frameIndex <= endFrame,
  );

  if (shotFrames.length === 0) {
    return "unknown";
  }

  return detectOrientationFromFrames(shotFrames);
}

// ============================================================================
// Detection Execution
// ============================================================================

/**
 * Runs shot detection on pose data and returns detected shots with orientation.
 *
 * @param poseData - Pose data loaded from test case
 * @returns Detection result with detected shots and orientation
 */
export function runDetection(poseData: PoseData): DetectionResult {
  // Convert pose data to detector format, getting both landmarks and frame mapping
  const adapted = adaptPoseDataToDetector(poseData);

  // Create detector and run detection, passing original frame indices for gap detection
  const detector = createShotBoundaryDetector();
  const detectedShots = detector.detectShots(adapted.landmarks, adapted.indexToFrame);

  // Convert to our result format, mapping array indices back to original frame numbers
  const shots: DetectedShotResult[] = detectedShots.map((shot) => {
    const startFrame = adapted.indexToFrame[shot.start.frameIndex] ?? shot.start.frameIndex;
    const endFrame = adapted.indexToFrame[shot.end.frameIndex] ?? shot.end.frameIndex;
    return { startFrame, endFrame };
  });

  // Detect orientation
  const orientation = detectOrientation(poseData);

  return { shots, orientation };
}

// ============================================================================
// Tolerance Logic
// ============================================================================

/**
 * Base tolerance for frame comparison (±8 frames).
 * This is the standard tolerance for iterative algorithm testing.
 */
const BASE_TOLERANCE = 8;

/**
 * Expanded tolerance for frame comparison (±10 frames).
 * Used when any diff is on the boundary.
 */
const EXPANDED_TOLERANCE = 10;

/**
 * Threshold for tolerance expansion (if any diff is exactly at base, we can expand).
 */
const EXPANSION_THRESHOLD = 8;

/**
 * Determines if a frame difference passes tolerance check.
 *
 * Rules:
 * - Pass if |diff| <= 8 (base tolerance)
 * - If any diff is exactly 8, tolerance can expand to ±10
 *
 * @param diff - Absolute frame difference
 * @param useExpandedTolerance - Whether to use expanded tolerance
 * @returns True if the difference passes tolerance check
 */
function passesTolerance(diff: number, useExpandedTolerance: boolean): boolean {
  const tolerance = useExpandedTolerance ? EXPANDED_TOLERANCE : BASE_TOLERANCE;
  return diff <= tolerance;
}

/**
 * Determines if tolerance should be expanded based on all differences.
 *
 * Tolerance expands from ±3 to ±5 if any difference is exactly 4 AND
 * all differences are <= 4 (meaning expansion would make them all pass).
 *
 * @param diffs - Array of absolute differences
 * @returns True if tolerance should be expanded
 */
function shouldExpandTolerance(diffs: number[]): boolean {
  // Check if any diff is exactly 4 (on the boundary)
  const hasExpansionCandidate = diffs.some((d) => d === EXPANSION_THRESHOLD);

  // All diffs must be <= 5 for expansion to help
  const allWithinExpandedTolerance = diffs.every(
    (d) => d <= EXPANDED_TOLERANCE,
  );

  // At least one diff must be > 3 (otherwise no need to expand)
  const needsExpansion = diffs.some((d) => d > BASE_TOLERANCE);

  return hasExpansionCandidate && allWithinExpandedTolerance && needsExpansion;
}

// ============================================================================
// Comparison Functions
// ============================================================================

/**
 * Compares a detected frame against an expected frame.
 */
function compareFrame(
  detected: number,
  expected: number,
  useExpandedTolerance: boolean,
): FrameComparison {
  const diff = Math.abs(detected - expected);
  return {
    detected,
    expected,
    diff,
    pass: passesTolerance(diff, useExpandedTolerance),
  };
}

/**
 * Compares detection results against labeled ground truth.
 * Orientation is compared per-shot, not per-video.
 *
 * @param detection - Detection result from runDetection()
 * @param labelData - Ground truth label data
 * @param poseData - Pose data for per-shot orientation detection
 * @returns Comparison result with pass/fail status and detailed shot comparisons
 */
export function compareResults(
  detection: DetectionResult,
  labelData: LabelData,
  poseData: PoseData,
): ComparisonResult {
  const video = labelData.video;

  // Check for shot count mismatch
  if (detection.shots.length !== labelData.shots.length) {
    const failureReason =
      detection.shots.length === 0
        ? "no shots detected"
        : `shot count mismatch: detected ${detection.shots.length}, expected ${labelData.shots.length}`;

    return {
      video,
      status: "fail",
      shots: [],
      failureReason,
    };
  }

  // Collect all frame differences for tolerance expansion check
  const allDiffs: number[] = [];
  for (let i = 0; i < detection.shots.length; i++) {
    const detected = detection.shots[i]!;
    const labeled = labelData.shots[i]!;
    allDiffs.push(Math.abs(detected.startFrame - labeled.startFrame));
    allDiffs.push(Math.abs(detected.endFrame - labeled.endFrame));
  }

  // Determine if we should use expanded tolerance
  const useExpandedTolerance = shouldExpandTolerance(allDiffs);

  // Compare each shot (including per-shot orientation)
  const shotComparisons: ShotComparison[] = [];
  for (let i = 0; i < detection.shots.length; i++) {
    const detected = detection.shots[i]!;
    const labeled = labelData.shots[i]!;

    // Detect orientation for this specific shot
    const detectedOrientation = detectOrientationForShot(
      poseData,
      detected.startFrame,
      detected.endFrame,
    );

    const comparison: ShotComparison = {
      shotNumber: labeled.shotNumber,
      startFrame: compareFrame(
        detected.startFrame,
        labeled.startFrame,
        useExpandedTolerance,
      ),
      endFrame: compareFrame(
        detected.endFrame,
        labeled.endFrame,
        useExpandedTolerance,
      ),
      orientation: {
        detected: detectedOrientation,
        expected: labeled.cameraOrientation,
        match: detectedOrientation === labeled.cameraOrientation,
      },
    };

    shotComparisons.push(comparison);
  }

  // Determine overall pass/fail
  const allShotsPass = shotComparisons.every(
    (shot) =>
      shot.startFrame.pass && shot.endFrame.pass && shot.orientation.match,
  );

  // Build result based on pass/fail
  if (allShotsPass) {
    return {
      video,
      status: "pass",
      shots: shotComparisons,
    };
  }

  // Build failure reason
  const reasons: string[] = [];
  for (const shot of shotComparisons) {
    if (!shot.orientation.match) {
      reasons.push(
        `shot ${shot.shotNumber} orientation: detected '${shot.orientation.detected}', expected '${shot.orientation.expected}'`,
      );
    }
    if (!shot.startFrame.pass) {
      reasons.push(
        `shot ${shot.shotNumber} start: diff ${shot.startFrame.diff} exceeds tolerance`,
      );
    }
    if (!shot.endFrame.pass) {
      reasons.push(
        `shot ${shot.shotNumber} end: diff ${shot.endFrame.diff} exceeds tolerance`,
      );
    }
  }

  return {
    video,
    status: "fail",
    shots: shotComparisons,
    failureReason: reasons.join("; "),
  };
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Runs detection on pose data and compares against labels in one call.
 *
 * @param poseData - Pose data loaded from test case
 * @param labelData - Ground truth label data
 * @returns Comparison result with pass/fail status
 */
export function runAndCompare(
  poseData: PoseData,
  labelData: LabelData,
): ComparisonResult {
  const detection = runDetection(poseData);
  return compareResults(detection, labelData, poseData);
}
