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
import type { PoseLandmarks } from "../pose/types";
import type { PoseData, LabelData, LabeledShot, Orientation, Frame, KeyframeId, KeyframeComparisonResult } from "./types";
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
    /** Per-keyframe comparison results */
    readonly keyframes: readonly KeyframeComparisonResult[];
    /** Whether keyframe validation was excluded due to pose limitations (e.g., behind-view with low elbow visibility) */
    readonly keyframeValidationExcluded?: boolean;
    /** Reason for keyframe validation exclusion */
    readonly exclusionReason?: string;
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
export declare function adaptPoseDataToDetector(poseData: PoseData): AdaptedPoseData;
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
export declare function detectOrientationFromFrames(frames: readonly Frame[]): Orientation | "unknown";
/**
 * Detects camera orientation from pose data by sampling frames.
 *
 * @param poseData - Pose data to analyze
 * @returns Detected orientation or 'unknown' if detection fails
 */
export declare function detectOrientation(poseData: PoseData): Orientation | "unknown";
/**
 * Detects camera orientation for a specific shot (frame range).
 *
 * @param poseData - Full pose data
 * @param startFrame - Start frame index (inclusive)
 * @param endFrame - End frame index (inclusive)
 * @returns Detected orientation or 'unknown' if detection fails
 */
export declare function detectOrientationForShot(poseData: PoseData, startFrame: number, endFrame: number): Orientation | "unknown";
/**
 * Checks if a shot should be excluded from keyframe validation due to pose limitations.
 *
 * Behind-view shots (behind, behind-left, behind-right) are excluded when
 * either elbow has average visibility below the threshold. This is because
 * the shooting arm may not be reliably visible, making elbow angle calculations
 * unreliable for set_point and release detection.
 *
 * For behind-view shots:
 * - behind-left: right side of body is partially hidden
 * - behind-right: left side of body is partially hidden
 * - behind: both sides may have visibility issues
 *
 * @param poseData - Full pose data for the video
 * @param startFrame - Shot start frame index (inclusive)
 * @param endFrame - Shot end frame index (inclusive)
 * @param orientation - Detected camera orientation for this shot
 * @returns Object with excluded flag and reason
 */
export declare function shouldExcludeKeyframeValidation(poseData: PoseData, startFrame: number, endFrame: number, orientation: Orientation | "unknown"): {
    excluded: boolean;
    reason?: string;
};
/**
 * Runs shot detection on pose data and returns detected shots with orientation.
 *
 * @param poseData - Pose data loaded from test case
 * @returns Detection result with detected shots and orientation
 */
export declare function runDetection(poseData: PoseData): DetectionResult;
/**
 * Runs keyframe detection on a single shot and returns a Map of keyframe IDs to frame numbers.
 *
 * @param poseData - Full pose data for the video
 * @param startFrame - Shot start frame index (inclusive)
 * @param endFrame - Shot end frame index (inclusive)
 * @returns Map of keyframe IDs to detected frame numbers (or null if not detected)
 */
export declare function detectKeyframesForShot(poseData: PoseData, startFrame: number, endFrame: number): Map<KeyframeId, number | null>;
/**
 * Compares all keyframes for a labeled shot.
 *
 * Edge cases handled:
 * - Labeled keyframe is null/undefined: Skip comparison, passed = true (not labeled = not tested)
 * - Detected keyframe is null but label exists: Failure (missed detection)
 * - Keyframe detected but no label: Cannot validate, passed = true (no ground truth)
 *
 * @param labeledShot - The labeled shot with keyframe annotations
 * @param detectedKeyframes - Map of keyframe IDs to detected frame numbers (currently unused, placeholder for future keyframe detection)
 * @returns Array of KeyframeComparisonResult for all 10 keyframes
 */
export declare function compareKeyframes(labeledShot: LabeledShot, detectedKeyframes?: Map<KeyframeId, number | null>): KeyframeComparisonResult[];
/**
 * Compares detection results against labeled ground truth.
 * Orientation is compared per-shot, not per-video.
 *
 * @param detection - Detection result from runDetection()
 * @param labelData - Ground truth label data
 * @param poseData - Pose data for per-shot orientation detection
 * @returns Comparison result with pass/fail status and detailed shot comparisons
 */
export declare function compareResults(detection: DetectionResult, labelData: LabelData, poseData: PoseData): ComparisonResult;
/**
 * Runs detection on pose data and compares against labels in one call.
 *
 * @param poseData - Pose data loaded from test case
 * @param labelData - Ground truth label data
 * @returns Comparison result with pass/fail status
 */
export declare function runAndCompare(poseData: PoseData, labelData: LabelData): ComparisonResult;
//# sourceMappingURL=detection.d.ts.map