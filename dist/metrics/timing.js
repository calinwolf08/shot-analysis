/**
 * Timing and synchronization metric calculators for basketball shot analysis.
 *
 * This module provides calculators for measuring shot timing and coordination:
 * - ballRiseStart: when ball begins upward motion (% of shot)
 * - legRiseStart: when legs begin extending (% of shot)
 * - ballLegSync: difference between ball and leg rise (%, negative = ball first)
 * - releaseStart: when release motion begins (% of shot)
 * - totalShotDuration: full shot from gather to follow-through (ms)
 *
 * @see Feature 5.7 - Timing & Synchronization Metrics
 */
import { calculateAngle } from "../utils/geometry";
import { ShotPhase } from "../detection/types";
import { LANDMARK_INDICES } from "../types";
/**
 * Minimum upward velocity (normalized Y decrease per frame) to detect ball rise.
 * Uses negative values since Y decreases when moving up in image coordinates.
 */
const BALL_RISE_VELOCITY_THRESHOLD = 0.02;
/**
 * Minimum angle increase (degrees per frame) to consider as "starting extension".
 * This threshold prevents noise from triggering false extension detection.
 */
const LEG_EXTENSION_VELOCITY_THRESHOLD = 2;
/**
 * Number of frames to use for velocity smoothing to avoid noise.
 */
const SMOOTHING_WINDOW = 2;
/**
 * Helper to get a pose at a specific frame index from the pose landmarks array.
 * Handles the case where frameIndex doesn't match array index.
 */
function getPoseAtFrame(poseLandmarks, frameIndex) {
    // First try direct lookup assuming poseLandmarks is indexed by frame
    const directPose = poseLandmarks.find((p) => p.frameIndex === frameIndex);
    if (directPose)
        return directPose;
    // Fall back to array index if frame indices don't match
    const arrayIndex = frameIndex -
        (poseLandmarks.length > 0 ? (poseLandmarks[0]?.frameIndex ?? 0) : 0);
    if (arrayIndex >= 0 && arrayIndex < poseLandmarks.length) {
        return poseLandmarks[arrayIndex];
    }
    return undefined;
}
/**
 * Calculates the minimum confidence from a set of landmarks.
 */
function calculateMinConfidence(landmarks) {
    if (landmarks.length === 0)
        return 0;
    return Math.min(...landmarks.map((l) => l.visibility));
}
/**
 * Calculates the average knee angle from both legs.
 * Knee angle is measured as hip-knee-ankle angle.
 * Returns undefined if landmarks are missing.
 */
function getAverageKneeAngle(pose) {
    const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP];
    const leftKnee = pose.landmarks[LANDMARK_INDICES.LEFT_KNEE];
    const leftAnkle = pose.landmarks[LANDMARK_INDICES.LEFT_ANKLE];
    const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP];
    const rightKnee = pose.landmarks[LANDMARK_INDICES.RIGHT_KNEE];
    const rightAnkle = pose.landmarks[LANDMARK_INDICES.RIGHT_ANKLE];
    if (!leftHip ||
        !leftKnee ||
        !leftAnkle ||
        !rightHip ||
        !rightKnee ||
        !rightAnkle) {
        return undefined;
    }
    const leftAngle = calculateAngle(leftHip.position, leftKnee.position, leftAnkle.position);
    const rightAngle = calculateAngle(rightHip.position, rightKnee.position, rightAnkle.position);
    return (leftAngle + rightAngle) / 2;
}
/**
 * Gets the average wrist Y position (ball proxy).
 * Returns undefined if landmarks are missing.
 */
function getAverageWristY(pose) {
    const leftWrist = pose.landmarks[LANDMARK_INDICES.LEFT_WRIST];
    const rightWrist = pose.landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    if (!leftWrist || !rightWrist) {
        return undefined;
    }
    return (leftWrist.position.y + rightWrist.position.y) / 2;
}
/**
 * Gets the minimum visibility of wrist landmarks.
 */
function getWristConfidence(pose) {
    const leftWrist = pose.landmarks[LANDMARK_INDICES.LEFT_WRIST];
    const rightWrist = pose.landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    if (!leftWrist || !rightWrist) {
        return 0;
    }
    return calculateMinConfidence([leftWrist, rightWrist]);
}
/**
 * Gets the minimum visibility of leg landmarks.
 */
function getLegConfidence(pose) {
    const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP];
    const leftKnee = pose.landmarks[LANDMARK_INDICES.LEFT_KNEE];
    const leftAnkle = pose.landmarks[LANDMARK_INDICES.LEFT_ANKLE];
    const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP];
    const rightKnee = pose.landmarks[LANDMARK_INDICES.RIGHT_KNEE];
    const rightAnkle = pose.landmarks[LANDMARK_INDICES.RIGHT_ANKLE];
    const landmarks = [
        leftHip,
        leftKnee,
        leftAnkle,
        rightHip,
        rightKnee,
        rightAnkle,
    ].filter((l) => l !== undefined);
    return calculateMinConfidence(landmarks);
}
/**
 * Detects the frame where the ball starts rising.
 * Uses wrist position as a proxy for ball position.
 * Returns frame index and confidence.
 */
function detectBallRiseFrame(poseLandmarks, frameRange) {
    let previousY = null;
    let previousPreviousY = null;
    let minConfidence = 1.0;
    for (let frameIndex = frameRange.start; frameIndex <= frameRange.end; frameIndex++) {
        const pose = getPoseAtFrame(poseLandmarks, frameIndex);
        if (!pose)
            continue;
        const currentY = getAverageWristY(pose);
        if (currentY === undefined)
            continue;
        const confidence = getWristConfidence(pose);
        if (confidence < minConfidence) {
            minConfidence = confidence;
        }
        // Need at least SMOOTHING_WINDOW previous frames for velocity detection
        if (previousY !== null && previousPreviousY !== null) {
            // Calculate smoothed velocity (average change over window)
            const avgVelocity = (previousPreviousY - currentY) / SMOOTHING_WINDOW;
            // Detect upward motion (Y decreasing in image coordinates)
            if (avgVelocity >= BALL_RISE_VELOCITY_THRESHOLD) {
                return {
                    frame: frameIndex - 1, // Rise started on previous frame
                    confidence: Math.min(minConfidence, confidence),
                };
            }
        }
        previousPreviousY = previousY;
        previousY = currentY;
    }
    return undefined;
}
/**
 * Detects the frame where the legs start extending.
 * Uses knee angle as the indicator.
 * Returns frame index and confidence.
 */
function detectLegRiseFrame(poseLandmarks, frameRange) {
    // First find the minimum knee angle (maximum bend)
    let minAngle = 180;
    let minAngleFrame = frameRange.start;
    for (let frameIndex = frameRange.start; frameIndex <= frameRange.end; frameIndex++) {
        const pose = getPoseAtFrame(poseLandmarks, frameIndex);
        if (!pose)
            continue;
        const angle = getAverageKneeAngle(pose);
        if (angle === undefined)
            continue;
        if (angle < minAngle) {
            minAngle = angle;
            minAngleFrame = frameIndex;
        }
    }
    // Then find when angle starts increasing from the minimum
    let previousAngle = null;
    let previousPreviousAngle = null;
    for (let frameIndex = minAngleFrame; frameIndex <= frameRange.end; frameIndex++) {
        const pose = getPoseAtFrame(poseLandmarks, frameIndex);
        if (!pose)
            continue;
        const currentAngle = getAverageKneeAngle(pose);
        if (currentAngle === undefined)
            continue;
        const confidence = getLegConfidence(pose);
        // Need at least SMOOTHING_WINDOW previous frames for velocity detection
        if (previousAngle !== null && previousPreviousAngle !== null) {
            // Calculate smoothed velocity (average angle increase over window)
            const avgVelocity = (currentAngle - previousPreviousAngle) / SMOOTHING_WINDOW;
            // Detect extension (angle increasing)
            if (avgVelocity >= LEG_EXTENSION_VELOCITY_THRESHOLD) {
                return {
                    frame: frameIndex - 1, // Extension started on previous frame
                    confidence,
                };
            }
        }
        previousPreviousAngle = previousAngle;
        previousAngle = currentAngle;
    }
    // If no clear extension detected, use frame after minimum bend
    const pose = getPoseAtFrame(poseLandmarks, minAngleFrame);
    const confidence = pose ? getLegConfidence(pose) : 0.5;
    return {
        frame: Math.min(minAngleFrame + 1, frameRange.end),
        confidence,
    };
}
/**
 * Calculator for ball rise start timing.
 *
 * Detects when the ball begins its upward motion using wrist position
 * as a proxy. Reports the timing as a percentage of the total shot duration.
 */
export class BallRiseStartCalculator {
    name = "ballRiseStart";
    description = "When ball begins upward motion (% of shot duration)";
    unit = "percent";
    calculate(context) {
        const { poseLandmarks, phases, frameRange } = context;
        // Need rise phase to confirm shot progression
        const risePhase = phases[ShotPhase.Rise];
        if (!risePhase) {
            return { error: "Rise phase not detected" };
        }
        if (poseLandmarks.length === 0) {
            return { error: "No pose data available" };
        }
        // Total shot duration in frames
        const totalFrames = frameRange.end - frameRange.start + 1;
        if (totalFrames <= 0) {
            return { error: "Invalid frame range" };
        }
        // Detect ball rise
        const ballRise = detectBallRiseFrame(poseLandmarks, frameRange);
        if (!ballRise) {
            // If no clear rise detected, use rise phase start
            const percentage = ((risePhase.startFrame - frameRange.start) / totalFrames) * 100;
            const value = {
                value: Math.round(percentage * 10) / 10,
                unit: this.unit,
                frame: risePhase.startFrame,
                confidence: 0.5, // Low confidence since we're falling back
            };
            return { value };
        }
        // Calculate percentage
        const framesSinceStart = ballRise.frame - frameRange.start;
        const percentage = (framesSinceStart / totalFrames) * 100;
        const value = {
            value: Math.round(percentage * 10) / 10,
            unit: this.unit,
            frame: ballRise.frame,
            confidence: ballRise.confidence,
        };
        return { value };
    }
}
/**
 * Calculator for leg rise start timing.
 *
 * Detects when the legs begin extending (knee angle starts increasing)
 * and reports the timing as a percentage of the total shot duration.
 */
export class LegRiseStartCalculator {
    name = "legRiseStart";
    description = "When legs begin extending (% of shot duration)";
    unit = "percent";
    calculate(context) {
        const { poseLandmarks, phases, frameRange } = context;
        // Need rise phase to confirm shot progression
        const risePhase = phases[ShotPhase.Rise];
        if (!risePhase) {
            return { error: "Rise phase not detected" };
        }
        if (poseLandmarks.length === 0) {
            return { error: "No pose data available" };
        }
        // Total shot duration in frames
        const totalFrames = frameRange.end - frameRange.start + 1;
        if (totalFrames <= 0) {
            return { error: "Invalid frame range" };
        }
        // Detect leg rise
        const legRise = detectLegRiseFrame(poseLandmarks, frameRange);
        if (!legRise) {
            // If no clear rise detected, use rise phase start
            const percentage = ((risePhase.startFrame - frameRange.start) / totalFrames) * 100;
            const value = {
                value: Math.round(percentage * 10) / 10,
                unit: this.unit,
                frame: risePhase.startFrame,
                confidence: 0.5, // Low confidence since we're falling back
            };
            return { value };
        }
        // Calculate percentage
        const framesSinceStart = legRise.frame - frameRange.start;
        const percentage = (framesSinceStart / totalFrames) * 100;
        const value = {
            value: Math.round(percentage * 10) / 10,
            unit: this.unit,
            frame: legRise.frame,
            confidence: legRise.confidence,
        };
        return { value };
    }
}
/**
 * Calculator for ball-leg synchronization.
 *
 * Calculates the difference between ball rise start and leg rise start
 * as a percentage of total shot duration. Negative values indicate
 * ball rises first; positive values indicate legs rise first.
 */
export class BallLegSyncCalculator {
    name = "ballLegSync";
    description = "Ball-leg sync: difference between ball and leg rise (%, negative = ball first)";
    unit = "percent";
    calculate(context) {
        const { poseLandmarks, phases, frameRange } = context;
        // Need rise phase to confirm shot progression
        const risePhase = phases[ShotPhase.Rise];
        if (!risePhase) {
            return { error: "Rise phase not detected" };
        }
        if (poseLandmarks.length === 0) {
            return { error: "No pose data available" };
        }
        // Total shot duration in frames
        const totalFrames = frameRange.end - frameRange.start + 1;
        if (totalFrames <= 0) {
            return { error: "Invalid frame range" };
        }
        // Detect both rise events
        const ballRise = detectBallRiseFrame(poseLandmarks, frameRange);
        const legRise = detectLegRiseFrame(poseLandmarks, frameRange);
        // Use detected frames or fall back to rise phase start
        const ballFrame = ballRise?.frame ?? risePhase.startFrame;
        const legFrame = legRise?.frame ?? risePhase.startFrame;
        // Calculate sync: leg - ball (negative = ball first)
        const frameDiff = legFrame - ballFrame;
        const syncPercentage = (frameDiff / totalFrames) * 100;
        // Average confidence
        const ballConfidence = ballRise?.confidence ?? 0.5;
        const legConfidence = legRise?.confidence ?? 0.5;
        const avgConfidence = (ballConfidence + legConfidence) / 2;
        const value = {
            value: Math.round(syncPercentage * 10) / 10,
            unit: this.unit,
            frame: Math.min(ballFrame, legFrame),
            confidence: avgConfidence,
        };
        return { value };
    }
}
/**
 * Calculator for release start timing.
 *
 * Reports when the release motion begins as a percentage of the
 * total shot duration. Uses the release phase start frame.
 */
export class ReleaseStartCalculator {
    name = "releaseStart";
    description = "When release motion begins (% of shot duration)";
    unit = "percent";
    calculate(context) {
        const { poseLandmarks, phases, frameRange } = context;
        // Need release phase
        const releasePhase = phases[ShotPhase.Release];
        if (!releasePhase) {
            return { error: "Release phase not detected" };
        }
        // Total shot duration in frames
        const totalFrames = frameRange.end - frameRange.start + 1;
        if (totalFrames <= 0) {
            return { error: "Invalid frame range" };
        }
        // Calculate percentage
        const framesSinceStart = releasePhase.startFrame - frameRange.start;
        const percentage = (framesSinceStart / totalFrames) * 100;
        // Get confidence from release frame pose
        let confidence = 0.9;
        if (poseLandmarks.length > 0) {
            const pose = getPoseAtFrame(poseLandmarks, releasePhase.startFrame);
            if (pose) {
                confidence = pose.confidence;
            }
        }
        const value = {
            value: Math.round(percentage * 10) / 10,
            unit: this.unit,
            frame: releasePhase.startFrame,
            confidence,
        };
        return { value };
    }
}
/**
 * Calculator for total shot duration.
 *
 * Calculates the total duration of the shot from gather to follow-through
 * in milliseconds, using pose timestamps for accurate timing.
 */
export class TotalShotDurationCalculator {
    name = "totalShotDuration";
    description = "Full shot duration from gather to follow-through (ms)";
    unit = "ms";
    calculate(context) {
        const { poseLandmarks, frameRange } = context;
        if (poseLandmarks.length === 0) {
            return { error: "No pose data available" };
        }
        // Validate frame range
        if (frameRange.end < frameRange.start) {
            return { error: "Invalid frame range" };
        }
        // Get timestamps from first and last frame
        const firstPose = getPoseAtFrame(poseLandmarks, frameRange.start);
        const lastPose = getPoseAtFrame(poseLandmarks, frameRange.end);
        if (!firstPose || !lastPose) {
            // Fall back to frame count estimation if poses are missing
            // Assume 30fps as default
            const frameCount = frameRange.end - frameRange.start + 1;
            const estimatedDuration = (frameCount / 30) * 1000;
            const value = {
                value: Math.round(estimatedDuration),
                unit: this.unit,
                frame: frameRange.start,
                confidence: 0.5, // Low confidence for estimation
            };
            return { value };
        }
        // Calculate duration from timestamps
        const durationMs = lastPose.timestamp - firstPose.timestamp;
        // Average confidence
        const avgConfidence = (firstPose.confidence + lastPose.confidence) / 2;
        const value = {
            value: Math.round(durationMs * 10) / 10,
            unit: this.unit,
            frame: frameRange.start,
            confidence: avgConfidence,
        };
        return { value };
    }
}
/**
 * Creates all timing calculators.
 * Convenience function for registering all calculators with the orchestrator.
 */
export function createTimingCalculators() {
    return Object.freeze([
        new BallRiseStartCalculator(),
        new LegRiseStartCalculator(),
        new BallLegSyncCalculator(),
        new ReleaseStartCalculator(),
        new TotalShotDurationCalculator(),
    ]);
}
//# sourceMappingURL=timing.js.map