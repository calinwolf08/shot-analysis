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
 * Returns null if the frame has no landmarks (no pose detected).
 */
function convertFrameToPoseLandmarks(frame) {
    if (frame.landmarks === null) {
        return null;
    }
    return {
        landmarks: frame.landmarks.map(convertTestLandmarkToLandmark),
        poseConfidence: frame.poseConfidence,
    };
}
/**
 * Converts PoseData frames to an array of PoseLandmarks for the shot detector.
 * Frames with null landmarks are filtered out.
 *
 * @param poseData - Pose data loaded from test case
 * @returns Array of PoseLandmarks suitable for shot detection (null frames filtered)
 */
export function adaptPoseDataToDetector(poseData) {
    const results = [];
    for (const frame of poseData.frames) {
        const converted = convertFrameToPoseLandmarks(frame);
        if (converted !== null) {
            results.push(converted);
        }
    }
    return results;
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
export function detectOrientationFromFrames(frames) {
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
        if (leftShoulder.visibility < minVisibility ||
            rightShoulder.visibility < minVisibility ||
            leftHip.visibility < minVisibility ||
            rightHip.visibility < minVisibility) {
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
    // Front view: rightShoulder.x > leftShoulder.x (positive avgShoulderDiffX)
    // Back view: rightShoulder.x < leftShoulder.x (negative avgShoulderDiffX, reversed)
    const isFrontView = avgShoulderDiffX > 0;
    const isBackView = avgShoulderDiffX < 0;
    // Thresholds for determining orientation
    const frontBackThreshold = 0.15; // Shoulders clearly separated in X
    const sideThreshold = 0.05; // Shoulders nearly aligned in X
    const angleThreshold = 0.05; // Z-depth threshold for angular views
    // Absolute shoulder separation for front/back vs side determination
    const shoulderSeparation = Math.abs(avgShoulderDiffX);
    const hipSeparation = Math.abs(avgHipDiffX);
    const avgSeparation = (shoulderSeparation + hipSeparation) / 2;
    if (avgSeparation > frontBackThreshold) {
        // Good shoulder separation - frontal or back view
        if (isFrontView) {
            // Front-facing orientations
            if (avgZDiff > angleThreshold) {
                return "front-left";
            }
            else if (avgZDiff < -angleThreshold) {
                return "front-right";
            }
            return "front";
        }
        else if (isBackView) {
            // Back-facing orientations (shoulders appear reversed)
            // Z-depth interpretation is also reversed for back views
            if (avgZDiff > angleThreshold) {
                return "behind-left";
            }
            else if (avgZDiff < -angleThreshold) {
                return "behind-right";
            }
            return "behind";
        }
    }
    else if (avgSeparation < sideThreshold) {
        // Shoulders very close in X - pure side view
        if (avgZDiff > 0) {
            return "side-left";
        }
        else {
            return "side-right";
        }
    }
    else {
        // In between - angled view (front-left, front-right, behind-left, behind-right)
        if (isFrontView) {
            if (avgZDiff > 0) {
                return "front-left";
            }
            else if (avgZDiff < 0) {
                return "front-right";
            }
            return "front";
        }
        else if (isBackView) {
            if (avgZDiff > 0) {
                return "behind-left";
            }
            else if (avgZDiff < 0) {
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
export function detectOrientation(poseData) {
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
    const sampleFrames = poseData.frames.slice(startSample, startSample + sampleSize);
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
export function detectOrientationForShot(poseData, startFrame, endFrame) {
    // Get frames within the shot range
    const shotFrames = poseData.frames.filter((f) => f.frameIndex >= startFrame && f.frameIndex <= endFrame);
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
 * Orientation is compared per-shot, not per-video.
 *
 * @param detection - Detection result from runDetection()
 * @param labelData - Ground truth label data
 * @param poseData - Pose data for per-shot orientation detection
 * @returns Comparison result with pass/fail status and detailed shot comparisons
 */
export function compareResults(detection, labelData, poseData) {
    const video = labelData.video;
    // Check for shot count mismatch
    if (detection.shots.length !== labelData.shots.length) {
        const failureReason = detection.shots.length === 0
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
    const allDiffs = [];
    for (let i = 0; i < detection.shots.length; i++) {
        const detected = detection.shots[i];
        const labeled = labelData.shots[i];
        allDiffs.push(Math.abs(detected.startFrame - labeled.startFrame));
        allDiffs.push(Math.abs(detected.endFrame - labeled.endFrame));
    }
    // Determine if we should use expanded tolerance
    const useExpandedTolerance = shouldExpandTolerance(allDiffs);
    // Compare each shot (including per-shot orientation)
    const shotComparisons = [];
    for (let i = 0; i < detection.shots.length; i++) {
        const detected = detection.shots[i];
        const labeled = labelData.shots[i];
        // Detect orientation for this specific shot
        const detectedOrientation = detectOrientationForShot(poseData, detected.startFrame, detected.endFrame);
        const comparison = {
            shotNumber: labeled.shotNumber,
            startFrame: compareFrame(detected.startFrame, labeled.startFrame, useExpandedTolerance),
            endFrame: compareFrame(detected.endFrame, labeled.endFrame, useExpandedTolerance),
            orientation: {
                detected: detectedOrientation,
                expected: labeled.cameraOrientation,
                match: detectedOrientation === labeled.cameraOrientation,
            },
        };
        shotComparisons.push(comparison);
    }
    // Determine overall pass/fail
    const allShotsPass = shotComparisons.every((shot) => shot.startFrame.pass && shot.endFrame.pass && shot.orientation.match);
    // Build result based on pass/fail
    if (allShotsPass) {
        return {
            video,
            status: "pass",
            shots: shotComparisons,
        };
    }
    // Build failure reason
    const reasons = [];
    for (const shot of shotComparisons) {
        if (!shot.orientation.match) {
            reasons.push(`shot ${shot.shotNumber} orientation: detected '${shot.orientation.detected}', expected '${shot.orientation.expected}'`);
        }
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
    return compareResults(detection, labelData, poseData);
}
//# sourceMappingURL=detection.js.map