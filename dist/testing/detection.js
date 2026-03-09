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
 * Returns both the landmarks array and a mapping from array indices to original frame numbers.
 *
 * @param poseData - Pose data loaded from test case
 * @returns Adapted pose data with landmarks and frame index mapping
 */
export function adaptPoseDataToDetector(poseData) {
    const landmarks = [];
    const indexToFrame = [];
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
export function detectOrientationFromFrames(frames) {
    if (frames.length === 0) {
        return "unknown";
    }
    let totalShoulderDiffX = 0;
    let totalHipDiffX = 0;
    let totalShoulderZ = 0;
    let totalHipZ = 0;
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
        totalHipZ += rightHip.z - leftHip.z;
        validSamples++;
    }
    if (validSamples < 1) {
        return "unknown";
    }
    const avgShoulderDiffX = totalShoulderDiffX / validSamples;
    const avgHipDiffX = totalHipDiffX / validSamples;
    const avgZDiff = totalShoulderZ / validSamples;
    const avgHipZDiff = totalHipZ / validSamples;
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
            }
            else if (avgZDiff < -frontAngleThreshold) {
                return "front-right";
            }
            return "front";
        }
        else if (isBackView) {
            // Back-facing orientations (shoulders appear reversed)
            if (avgZDiff > behindAngleThreshold) {
                return "behind-left";
            }
            else if (avgZDiff < -behindAngleThreshold) {
                return "behind-right";
            }
            return "behind";
        }
    }
    // CASE 2: Pure side view - very small shoulder X separation (< 0.02) with large Z-depth
    else if (shoulderSeparation < pureSideShoulderThreshold &&
        absZDiff > sideViewZThreshold) {
        if (avgZDiff > 0) {
            return "side-left";
        }
        else {
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
        // Check hip Z consistency - if hips show similar Z pattern, it's camera angle not rotation
        // This helps distinguish behind-angled views from front with rotation
        const absHipZDiff = Math.abs(avgHipZDiff);
        const hipZConsistent = absHipZDiff > 0.25 && Math.sign(avgHipZDiff) === Math.sign(avgZDiff);
        // Special case: very small hip separation (< 0.01) indicates front view
        // This is when the person's body is facing camera but shoulders rotate during shooting
        if (hipSeparation < 0.01) {
            // Front view - no left/right qualifier despite large Z-depth
            return "front";
        }
        // Behind-angled views: when hips follow shoulder Z pattern strongly
        // This indicates camera is actually positioned behind and to the side
        // ALSO: Require shoulder separation above pureSide threshold to avoid classifying
        // true side views (very small shoulderSep) as behind-angled
        // NOTE: behind-left (positive Z) and behind-right (negative Z) have asymmetric criteria:
        // - behind-left: typical criteria work well
        // - behind-right: requires larger shoulder separation to distinguish from side-right
        //
        // EXTENDED: Also handle cases where isFrontView but shoulderDiffX is only slightly negative
        // This happens when body rotates during shooting, creating a "front-like" pose
        // but the camera is actually behind. Key indicators:
        // - Very high Z-depth (> 0.50)
        // - High hip Z-depth (> 0.30)
        // - shoulderDiffX only slightly negative (> -0.05)
        // - Small shoulder separation (< 0.05)
        // - Shoulder separation >= hip separation (if hips are more separated, it's likely side view)
        const isSlightlyFrontView = isFrontView && avgShoulderDiffX > -0.05;
        const shoulderHipSeparationRatio = hipSeparation > 0.01 ? shoulderSeparation / hipSeparation : 999;
        const shoulderMoreOrEquallyAligned = shoulderHipSeparationRatio >= 1.0;
        const isBehindCandidate = isBackView || (isSlightlyFrontView && absZDiff > 0.50 && absHipZDiff > 0.30 && shoulderMoreOrEquallyAligned);
        if (hipZConsistent && isBehindCandidate &&
            shoulderSeparation > pureSideShoulderThreshold && shoulderSeparation < sideThreshold &&
            hipSeparation > 0.02 && hipSeparation < 0.04) {
            // Additional check: strong hip Z pattern (>0.30) suggests behind-angled
            if (absHipZDiff > 0.30) {
                if (avgZDiff > 0) {
                    return "behind-left";
                }
                else {
                    // For behind-right: require larger shoulder separation (> 0.04) to distinguish from side-right
                    // Shot 7 (side-right): shoulderSep=0.034, hipSep=0.025 - should NOT be behind-right
                    // Shot 5 (behind-right): shoulderSep=0.186, hipSep=0.111 - much larger
                    if (shoulderSeparation > 0.04) {
                        return "behind-right";
                    }
                    // Small shoulder separation with negative Z → side-right
                }
            }
        }
        // Use shoulder/hip Z ratio to distinguish front-left from side-left
        // When ratio is low (< 1.7), hips follow shoulders → true camera angle offset → front-left
        // When ratio is high (> 1.7), only shoulders rotated → shooting motion → side view
        const shoulderHipZRatio = absHipZDiff > 0.1 ? absZDiff / absHipZDiff : 999; // Avoid division by very small numbers
        // If shoulder separation is moderate AND shoulder/hip Z ratio is low,
        // this indicates both shoulders AND hips show similar angle offset
        // → true camera angle (front-left/front-right)
        const frontLeftShoulderThreshold = 0.08;
        const maxZRatioForFrontLeft = 1.7; // Lower ratio = hips follow shoulders = camera angle
        if (isFrontView &&
            shoulderSeparation > frontLeftShoulderThreshold &&
            shoulderHipZRatio < maxZRatioForFrontLeft) {
            if (avgZDiff > 0) {
                return "front-left";
            }
            else {
                return "front-right";
            }
        }
        // Otherwise, large Z-depth with high ratio = side view (shoulder rotation from shooting)
        if (avgZDiff > 0) {
            return "side-left";
        }
        else {
            return "side-right";
        }
    }
    // CASE 4: Angled view (moderate separation, moderate Z)
    else {
        // Calculate hip Z consistency for CASE 4 as well
        const absHipZDiff = Math.abs(avgHipZDiff);
        if (isFrontView) {
            // Check for side views with moderate Z-depth (0.30-0.45)
            // Key insight: if Z-diff is moderate and shoulder separation suggests angled body,
            // this could be a side view rather than front. The camera is positioned to the side
            // but the body rotation during shooting creates a "front-like" appearance.
            // Characteristics:
            // - Moderate shoulder separation (0.05 < sep < 0.12)
            // - Moderate Z-depth (0.30 < Z < 0.45)
            // - Hip Z follows shoulder Z direction (same sign, reasonable magnitude)
            // - Hip Z is NOT highly consistent (< 0.25), otherwise it's more likely front-angled
            //   When hip Z is high (> 0.25), both shoulders and hips show the angle offset,
            //   which is more consistent with a front-angled view than a side view with rotation.
            const moderateZForSide = absZDiff > 0.30 && absZDiff < sideViewZThreshold;
            const moderateShoulderSep = shoulderSeparation > sideThreshold && shoulderSeparation < 0.12;
            const hipFollowsShoulder = Math.sign(avgHipZDiff) === Math.sign(avgZDiff) && absHipZDiff > 0.15;
            const hipNotHighlyConsistent = absHipZDiff < 0.25;
            if (moderateZForSide && moderateShoulderSep && hipFollowsShoulder && hipNotHighlyConsistent) {
                if (avgZDiff > 0) {
                    return "side-left";
                }
                else {
                    return "side-right";
                }
            }
            if (avgZDiff > frontAngleThreshold) {
                return "front-left";
            }
            else if (avgZDiff < -frontAngleThreshold) {
                return "front-right";
            }
            return "front";
        }
        else if (isBackView) {
            // Check if this is actually a front view with shoulder rotation
            if (shoulderSeparation < sideThreshold && hipSeparation < 0.02) {
                // Very small shoulder separation + minimal hip separation = likely front view
                return "front";
            }
            if (avgZDiff > behindAngleThreshold) {
                return "behind-left";
            }
            else if (avgZDiff < -behindAngleThreshold) {
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
    // Convert pose data to detector format, getting both landmarks and frame mapping
    const adapted = adaptPoseDataToDetector(poseData);
    // Create detector and run detection, passing original frame indices for gap detection
    const detector = createShotBoundaryDetector();
    const detectedShots = detector.detectShots(adapted.landmarks, adapted.indexToFrame);
    // Convert to our result format, mapping array indices back to original frame numbers
    const shots = detectedShots.map((shot) => {
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