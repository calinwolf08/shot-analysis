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
import { LANDMARK_INDEX } from "../pose/types";
import { createShotBoundaryDetector } from "../detection/shot-detector";
// ============================================================================
// Adapter: PoseData to PoseLandmarks
// ============================================================================
/**
 * Converts a TestLandmark (from test data) to a Landmark (for shot detector).
 * Adds a default confidence value since TestLandmark doesn't include it.
 */
function convertTestLandmarkToLandmark(testLandmark) {
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
 */
function convertFrameToPoseLandmarks(frame) {
    return {
        landmarks: frame.landmarks.map(convertTestLandmarkToLandmark),
        poseConfidence: frame.poseConfidence,
    };
}
/**
 * Converts PoseData frames to an array of PoseLandmarks for the shot detector.
 *
 * @param poseData - Pose data loaded from test case
 * @returns Array of PoseLandmarks suitable for shot detection
 */
export function adaptPoseDataToDetector(poseData) {
    return poseData.frames.map(convertFrameToPoseLandmarks);
}
// ============================================================================
// Orientation Detection
// ============================================================================
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
export function detectOrientation(poseData) {
    // Need at least some frames to analyze
    if (poseData.frames.length === 0) {
        return "unknown";
    }
    // Sample frames from the middle of the video (more stable poses)
    const startSample = Math.floor(poseData.frames.length * 0.3);
    const endSample = Math.floor(poseData.frames.length * 0.7);
    const sampleSize = Math.min(10, endSample - startSample);
    if (sampleSize < 3) {
        return "unknown";
    }
    let totalShoulderDiffX = 0;
    let totalHipDiffX = 0;
    let totalShoulderZ = 0;
    let validSamples = 0;
    for (let i = startSample; i < startSample + sampleSize && i < poseData.frames.length; i++) {
        const frame = poseData.frames[i];
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
        if (leftShoulder.visibility < minVisibility ||
            rightShoulder.visibility < minVisibility ||
            leftHip.visibility < minVisibility ||
            rightHip.visibility < minVisibility) {
            continue;
        }
        // X difference: positive = left is left of right (front view)
        // negative = left is right of right (back view or flipped)
        totalShoulderDiffX += rightShoulder.x - leftShoulder.x;
        totalHipDiffX += rightHip.x - leftHip.x;
        // Z difference: which side is closer to camera
        totalShoulderZ += rightShoulder.z - leftShoulder.z;
        validSamples++;
    }
    if (validSamples < 3) {
        return "unknown";
    }
    const avgShoulderDiffX = totalShoulderDiffX / validSamples;
    const avgHipDiffX = totalHipDiffX / validSamples;
    const avgZDiff = totalShoulderZ / validSamples;
    // Thresholds for determining orientation
    const frontThreshold = 0.15; // Shoulders clearly separated in X
    const sideThreshold = 0.05; // Shoulders nearly aligned in X
    // Determine orientation based on shoulder X separation
    const shoulderSeparation = Math.abs(avgShoulderDiffX);
    const hipSeparation = Math.abs(avgHipDiffX);
    const avgSeparation = (shoulderSeparation + hipSeparation) / 2;
    if (avgSeparation > frontThreshold) {
        // Good shoulder separation - frontal or front-angled view
        // Check if slightly angled based on Z depth difference
        const angleThreshold = 0.05;
        if (avgZDiff > angleThreshold) {
            // Right side is farther back - shot from front-left
            return "front-left";
        }
        else if (avgZDiff < -angleThreshold) {
            // Left side is farther back - shot from front-right
            return "front-right";
        }
        return "front";
    }
    else if (avgSeparation < sideThreshold) {
        // Shoulders very close in X - side view
        // Determine which side based on Z depth
        if (avgZDiff > 0) {
            // Right side is farther (we see left side)
            return "side-left";
        }
        else {
            // Left side is farther (we see right side)
            return "side-right";
        }
    }
    else {
        // In between - angled view
        if (avgZDiff > 0) {
            return "front-left";
        }
        else if (avgZDiff < 0) {
            return "front-right";
        }
        return "front";
    }
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
export function runDetection(poseData) {
    // Convert pose data to detector format
    const poseLandmarks = adaptPoseDataToDetector(poseData);
    // Create detector and run detection
    const detector = createShotBoundaryDetector();
    const detectedShots = detector.detectShots(poseLandmarks);
    // Convert to our result format
    const shots = detectedShots.map((shot) => ({
        startFrame: shot.start.frameIndex,
        endFrame: shot.end.frameIndex,
    }));
    // Detect orientation
    const orientation = detectOrientation(poseData);
    return { shots, orientation };
}
// ============================================================================
// Tolerance Logic
// ============================================================================
/**
 * Base tolerance for frame comparison (±3 frames).
 */
const BASE_TOLERANCE = 3;
/**
 * Expanded tolerance for frame comparison (±5 frames).
 */
const EXPANDED_TOLERANCE = 5;
/**
 * Threshold for tolerance expansion (if any diff is exactly 4, we can expand).
 */
const EXPANSION_THRESHOLD = 4;
/**
 * Determines if a frame difference passes tolerance check.
 *
 * Rules:
 * - Pass if |diff| <= 3 (base tolerance)
 * - If any diff is exactly 4, tolerance can expand to ±5
 *
 * @param diff - Absolute frame difference
 * @param useExpandedTolerance - Whether to use expanded tolerance
 * @returns True if the difference passes tolerance check
 */
function passesTolerance(diff, useExpandedTolerance) {
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
function shouldExpandTolerance(diffs) {
    // Check if any diff is exactly 4 (on the boundary)
    const hasExpansionCandidate = diffs.some((d) => d === EXPANSION_THRESHOLD);
    // All diffs must be <= 5 for expansion to help
    const allWithinExpandedTolerance = diffs.every((d) => d <= EXPANDED_TOLERANCE);
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
function compareFrame(detected, expected, useExpandedTolerance) {
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
 *
 * @param detection - Detection result from runDetection()
 * @param labelData - Ground truth label data
 * @returns Comparison result with pass/fail status and detailed shot comparisons
 */
export function compareResults(detection, labelData) {
    const video = labelData.video;
    // Check orientation match
    const orientationMatch = detection.orientation === labelData.orientation;
    // Check for shot count mismatch
    if (detection.shots.length !== labelData.shots.length) {
        const failureReason = detection.shots.length === 0
            ? "no shots detected"
            : `shot count mismatch: detected ${detection.shots.length}, expected ${labelData.shots.length}`;
        return {
            video,
            status: "fail",
            orientation: {
                detected: detection.orientation,
                expected: labelData.orientation,
                match: orientationMatch,
            },
            shots: [],
            failureReason,
        };
    }
    // Collect all frame differences for tolerance expansion check
    const allDiffs = [];
    for (let i = 0; i < detection.shots.length; i++) {
        const detected = detection.shots[i];
        const labeled = labelData.shots[i];
        allDiffs.push(Math.abs(detected.startFrame - labeled.startFrame));
        allDiffs.push(Math.abs(detected.endFrame - labeled.endFrame));
    }
    // Determine if we should use expanded tolerance
    const useExpandedTolerance = shouldExpandTolerance(allDiffs);
    // Compare each shot
    const shotComparisons = [];
    for (let i = 0; i < detection.shots.length; i++) {
        const detected = detection.shots[i];
        const labeled = labelData.shots[i];
        const comparison = {
            shotNumber: labeled.shotNumber,
            startFrame: compareFrame(detected.startFrame, labeled.startFrame, useExpandedTolerance),
            endFrame: compareFrame(detected.endFrame, labeled.endFrame, useExpandedTolerance),
        };
        shotComparisons.push(comparison);
    }
    // Determine overall pass/fail
    const allShotsPass = shotComparisons.every((shot) => shot.startFrame.pass && shot.endFrame.pass);
    const overallPass = allShotsPass && orientationMatch;
    // Build result based on pass/fail
    if (overallPass) {
        return {
            video,
            status: "pass",
            orientation: {
                detected: detection.orientation,
                expected: labelData.orientation,
                match: orientationMatch,
            },
            shots: shotComparisons,
        };
    }
    // Build failure reason
    const reasons = [];
    if (!orientationMatch) {
        reasons.push(`orientation mismatch: detected '${detection.orientation}', expected '${labelData.orientation}'`);
    }
    for (const shot of shotComparisons) {
        if (!shot.startFrame.pass) {
            reasons.push(`shot ${shot.shotNumber} start: diff ${shot.startFrame.diff} exceeds tolerance`);
        }
        if (!shot.endFrame.pass) {
            reasons.push(`shot ${shot.shotNumber} end: diff ${shot.endFrame.diff} exceeds tolerance`);
        }
    }
    return {
        video,
        status: "fail",
        orientation: {
            detected: detection.orientation,
            expected: labelData.orientation,
            match: orientationMatch,
        },
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
export function runAndCompare(poseData, labelData) {
    const detection = runDetection(poseData);
    return compareResults(detection, labelData);
}
//# sourceMappingURL=detection.js.map