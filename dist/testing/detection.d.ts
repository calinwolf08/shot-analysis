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
import type { PoseData, LabelData, Orientation } from "./types";
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
 * Comparison result for a single shot.
 */
export interface ShotComparison {
    /** Shot number (1-based, matching label data) */
    readonly shotNumber: number;
    /** Start frame comparison */
    readonly startFrame: FrameComparison;
    /** End frame comparison */
    readonly endFrame: FrameComparison;
}
/**
 * Overall comparison result for a video.
 */
export interface ComparisonResult {
    /** Video filename */
    readonly video: string;
    /** Overall pass/fail status */
    readonly status: "pass" | "fail";
    /** Orientation comparison */
    readonly orientation: {
        readonly detected: Orientation | "unknown";
        readonly expected: Orientation;
        readonly match: boolean;
    };
    /** Per-shot comparisons */
    readonly shots: readonly ShotComparison[];
    /** Failure reason if status is 'fail' */
    readonly failureReason?: string;
}
/**
 * Converts PoseData frames to an array of PoseLandmarks for the shot detector.
 *
 * @param poseData - Pose data loaded from test case
 * @returns Array of PoseLandmarks suitable for shot detection
 */
export declare function adaptPoseDataToDetector(poseData: PoseData): readonly PoseLandmarks[];
/**
 * Detects camera orientation from hip-shoulder alignment.
 *
 * The orientation is determined by comparing the X positions of shoulders and hips:
 * - front: Left landmarks are to the left of right landmarks (left.x < right.x)
 * - side-left: Shooter's left side visible (shoulders roughly aligned in X, left side closer)
 * - side-right: Shooter's right side visible (shoulders roughly aligned in X, right side closer)
 * - front-left: Between front and side-left
 * - front-right: Between front and side-right
 *
 * @param poseData - Pose data to analyze
 * @returns Detected orientation or 'unknown' if detection fails
 */
export declare function detectOrientation(poseData: PoseData): Orientation | "unknown";
/**
 * Runs shot detection on pose data and returns detected shots with orientation.
 *
 * @param poseData - Pose data loaded from test case
 * @returns Detection result with detected shots and orientation
 */
export declare function runDetection(poseData: PoseData): DetectionResult;
/**
 * Compares detection results against labeled ground truth.
 *
 * @param detection - Detection result from runDetection()
 * @param labelData - Ground truth label data
 * @returns Comparison result with pass/fail status and detailed shot comparisons
 */
export declare function compareResults(detection: DetectionResult, labelData: LabelData): ComparisonResult;
/**
 * Runs detection on pose data and compares against labels in one call.
 *
 * @param poseData - Pose data loaded from test case
 * @param labelData - Ground truth label data
 * @returns Comparison result with pass/fail status
 */
export declare function runAndCompare(poseData: PoseData, labelData: LabelData): ComparisonResult;
//# sourceMappingURL=detection.d.ts.map