/**
 * Keyframe detection for basketball shot analysis.
 *
 * This module detects specific keyframes within a basketball shot,
 * starting with Load phase keyframes (leg_bend_low_point, ball_low_point).
 *
 * @see Feature 2.0 - Keyframe Detection Algorithms
 */
import { LANDMARK_INDICES } from "./types";
import { movingAverage } from "./utils/smoothing";
/**
 * Default configuration values.
 */
const DEFAULT_CONFIG = {
    visibilityThreshold: 0.5,
    ballLowPointSearchWindow: 0.4,
    legBendSearchWindow: 0.5,
    riseSearchWindow: 0.6,
    smoothingWindowSize: 3,
    minConsecutiveFrames: 2,
    kneeVelocityThreshold: 0.5,
    wristVelocityThreshold: -0.005,
};
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
export function calculateKneeAngle(hip, knee, ankle) {
    if (!hip || !knee || !ankle) {
        return null;
    }
    // Convert to Point3D for calculation
    const hipPoint = { x: hip.x, y: hip.y, z: hip.z };
    const kneePoint = { x: knee.x, y: knee.y, z: knee.z };
    const anklePoint = { x: ankle.x, y: ankle.y, z: ankle.z };
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
    const magAnkle = Math.sqrt(vAnkle.x * vAnkle.x + vAnkle.y * vAnkle.y + vAnkle.z * vAnkle.z);
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
function getFrameKneeAngle(frame, visibilityThreshold) {
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
    const leftVisible = leftHip &&
        leftKnee &&
        leftAnkle &&
        leftHip.visibility >= visibilityThreshold &&
        leftKnee.visibility >= visibilityThreshold &&
        leftAnkle.visibility >= visibilityThreshold;
    const rightVisible = rightHip &&
        rightKnee &&
        rightAnkle &&
        rightHip.visibility >= visibilityThreshold &&
        rightKnee.visibility >= visibilityThreshold &&
        rightAnkle.visibility >= visibilityThreshold;
    const leftAngle = leftVisible
        ? calculateKneeAngle(leftHip, leftKnee, leftAnkle)
        : null;
    const rightAngle = rightVisible
        ? calculateKneeAngle(rightHip, rightKnee, rightAnkle)
        : null;
    // Return average of both, or whichever is available
    if (leftAngle !== null && rightAngle !== null) {
        return (leftAngle + rightAngle) / 2;
    }
    else if (leftAngle !== null) {
        return leftAngle;
    }
    else if (rightAngle !== null) {
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
function getFrameWristY(frame, visibilityThreshold) {
    if (!frame.landmarks) {
        return null;
    }
    const landmarks = frame.landmarks;
    const leftWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST];
    const rightWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    const leftVisible = leftWrist && leftWrist.visibility >= visibilityThreshold;
    const rightVisible = rightWrist && rightWrist.visibility >= visibilityThreshold;
    if (leftVisible && rightVisible) {
        return (leftWrist.y + rightWrist.y) / 2;
    }
    else if (leftVisible) {
        return leftWrist.y;
    }
    else if (rightVisible) {
        return rightWrist.y;
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
export function detectLegBendLowPoint(frames, startFrame, endFrame, config = DEFAULT_CONFIG) {
    const shotDuration = endFrame - startFrame + 1;
    const searchEndFrame = startFrame + Math.floor(shotDuration * config.legBendSearchWindow);
    let minAngle = Infinity;
    let minAngleFrame = null;
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
            if (frame.frameIndex >= startFrame &&
                frame.frameIndex <= searchEndFrame) {
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
export function detectBallLowPoint(frames, startFrame, endFrame, config = DEFAULT_CONFIG) {
    const shotDuration = endFrame - startFrame + 1;
    const searchEndFrame = startFrame + Math.floor(shotDuration * config.ballLowPointSearchWindow);
    let maxWristY = -Infinity;
    let maxWristYFrame = null;
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
            if (frame.frameIndex >= startFrame &&
                frame.frameIndex <= searchEndFrame) {
                if (getFrameWristY(frame, config.visibilityThreshold) !== null) {
                    return frame.frameIndex;
                }
            }
        }
    }
    return maxWristYFrame;
}
/**
 * Calculates velocity (frame-to-frame change) from a sequence of values.
 *
 * @param values - Array of numeric values
 * @returns Array of velocities (one element shorter than input)
 */
export function calculateVelocity(values) {
    const velocities = [];
    for (let i = 1; i < values.length; i++) {
        velocities.push(values[i] - values[i - 1]);
    }
    return velocities;
}
/**
 * Calculates smoothed velocity from a sequence of values.
 *
 * Applies moving average smoothing to the values first,
 * then calculates frame-to-frame velocity.
 *
 * @param values - Array of numeric values
 * @param windowSize - Smoothing window size
 * @returns Array of smoothed velocities (one element shorter than input)
 */
export function calculateSmoothedVelocity(values, windowSize) {
    if (values.length < 2) {
        return [];
    }
    const smoothedValues = movingAverage(values, windowSize);
    return calculateVelocity(smoothedValues);
}
/**
 * Detects the frame where legs start extending (knee angle starts increasing).
 *
 * This corresponds to the "legs_start_extending" keyframe in the Rise phase.
 * The detection looks for sustained positive knee angle velocity after the
 * leg_bend_low_point, indicating the knees are straightening.
 *
 * @param frames - Array of frames with pose data
 * @param legBendLowPointFrame - Frame index of the leg bend low point (from Load phase)
 * @param endFrame - Shot end frame index (inclusive)
 * @param config - Detection configuration
 * @returns Frame index where knee extension starts, or null if not detectable
 */
export function detectLegsStartExtending(frames, legBendLowPointFrame, endFrame, config = DEFAULT_CONFIG) {
    const shotDuration = endFrame - legBendLowPointFrame + 1;
    const searchEndFrame = legBendLowPointFrame + Math.floor(shotDuration * config.riseSearchWindow);
    // Extract knee angles for frames in the search window
    const frameAngles = [];
    for (const frame of frames) {
        const frameIdx = frame.frameIndex;
        // Only search from the low point forward
        if (frameIdx < legBendLowPointFrame || frameIdx > searchEndFrame) {
            continue;
        }
        const kneeAngle = getFrameKneeAngle(frame, config.visibilityThreshold);
        if (kneeAngle !== null) {
            frameAngles.push({ frameIndex: frameIdx, angle: kneeAngle });
        }
    }
    if (frameAngles.length < config.minConsecutiveFrames + 1) {
        return null;
    }
    // Sort by frame index to ensure proper order
    frameAngles.sort((a, b) => a.frameIndex - b.frameIndex);
    // Extract angles and calculate smoothed velocity
    const angles = frameAngles.map((fa) => fa.angle);
    const smoothedVelocities = calculateSmoothedVelocity(angles, config.smoothingWindowSize);
    // Find first frame with sustained positive velocity
    let consecutivePositive = 0;
    for (let i = 0; i < smoothedVelocities.length; i++) {
        const velocity = smoothedVelocities[i];
        if (velocity > config.kneeVelocityThreshold) {
            consecutivePositive++;
            if (consecutivePositive >= config.minConsecutiveFrames) {
                // Return the frame where the extension started
                // (subtract minConsecutiveFrames - 1 to get the start)
                const startIdx = i - config.minConsecutiveFrames + 1;
                // Add 1 because velocity[i] is between frame[i] and frame[i+1]
                return frameAngles[startIdx + 1].frameIndex;
            }
        }
        else {
            consecutivePositive = 0;
        }
    }
    return null;
}
/**
 * Detects the frame where the ball starts moving upward (wrist Y starts decreasing).
 *
 * This corresponds to the "ball_starts_upward" keyframe in the Rise phase.
 * The detection looks for sustained negative wrist Y velocity after the
 * ball_low_point, indicating the ball is rising (since Y=0 is top of frame).
 *
 * @param frames - Array of frames with pose data
 * @param ballLowPointFrame - Frame index of the ball low point (from Load phase)
 * @param endFrame - Shot end frame index (inclusive)
 * @param config - Detection configuration
 * @returns Frame index where upward ball motion starts, or null if not detectable
 */
export function detectBallStartsUpward(frames, ballLowPointFrame, endFrame, config = DEFAULT_CONFIG) {
    const shotDuration = endFrame - ballLowPointFrame + 1;
    const searchEndFrame = ballLowPointFrame + Math.floor(shotDuration * config.riseSearchWindow);
    // Extract wrist Y positions for frames in the search window
    const framePositions = [];
    for (const frame of frames) {
        const frameIdx = frame.frameIndex;
        // Only search from the low point forward
        if (frameIdx < ballLowPointFrame || frameIdx > searchEndFrame) {
            continue;
        }
        const wristY = getFrameWristY(frame, config.visibilityThreshold);
        if (wristY !== null) {
            framePositions.push({ frameIndex: frameIdx, wristY: wristY });
        }
    }
    if (framePositions.length < config.minConsecutiveFrames + 1) {
        return null;
    }
    // Sort by frame index to ensure proper order
    framePositions.sort((a, b) => a.frameIndex - b.frameIndex);
    // Extract wrist Y values and calculate smoothed velocity
    const wristYValues = framePositions.map((fp) => fp.wristY);
    const smoothedVelocities = calculateSmoothedVelocity(wristYValues, config.smoothingWindowSize);
    // Find first frame with sustained negative velocity (upward motion)
    // Negative velocity means Y is decreasing, which means the ball is rising
    let consecutiveNegative = 0;
    for (let i = 0; i < smoothedVelocities.length; i++) {
        const velocity = smoothedVelocities[i];
        // Note: threshold is negative, so velocity < threshold means moving up fast enough
        if (velocity < config.wristVelocityThreshold) {
            consecutiveNegative++;
            if (consecutiveNegative >= config.minConsecutiveFrames) {
                // Return the frame where upward motion started
                const startIdx = i - config.minConsecutiveFrames + 1;
                // Add 1 because velocity[i] is between frame[i] and frame[i+1]
                return framePositions[startIdx + 1].frameIndex;
            }
        }
        else {
            consecutiveNegative = 0;
        }
    }
    return null;
}
/**
 * KeyframeDetector class for detecting keyframes within basketball shots.
 *
 * Implements keyframe detection for:
 * - Load phase: leg_bend_low_point, ball_low_point
 * - Rise phase: legs_start_extending, ball_starts_upward
 */
export class KeyframeDetector {
    config;
    constructor(config = {}) {
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
    detectLoadPhaseKeyframes(frames, startFrame, endFrame) {
        const keyframes = [];
        // Detect leg_bend_low_point
        const legBendFrame = detectLegBendLowPoint(frames, startFrame, endFrame, this.config);
        keyframes.push({
            keyframeId: "leg_bend_low_point",
            frameIndex: legBendFrame,
            confidence: legBendFrame !== null ? 0.8 : 0.0,
        });
        // Detect ball_low_point
        const ballLowFrame = detectBallLowPoint(frames, startFrame, endFrame, this.config);
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
     * Detects Rise phase keyframes for a shot.
     *
     * Requires Load phase keyframes to have been detected first,
     * as Rise phase detection starts from the Load phase low points.
     *
     * @param frames - Array of frames with pose data
     * @param legBendLowPointFrame - Frame index of leg bend low point (from Load phase)
     * @param ballLowPointFrame - Frame index of ball low point (from Load phase)
     * @param endFrame - Shot end frame index (inclusive)
     * @returns Detection result with keyframes and confidence
     */
    detectRisePhaseKeyframes(frames, legBendLowPointFrame, ballLowPointFrame, endFrame) {
        const keyframes = [];
        // Detect legs_start_extending
        const legsExtendingFrame = detectLegsStartExtending(frames, legBendLowPointFrame, endFrame, this.config);
        keyframes.push({
            keyframeId: "legs_start_extending",
            frameIndex: legsExtendingFrame,
            confidence: legsExtendingFrame !== null ? 0.8 : 0.0,
        });
        // Detect ball_starts_upward
        const ballUpwardFrame = detectBallStartsUpward(frames, ballLowPointFrame, endFrame, this.config);
        keyframes.push({
            keyframeId: "ball_starts_upward",
            frameIndex: ballUpwardFrame,
            confidence: ballUpwardFrame !== null ? 0.8 : 0.0,
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
    getConfig() {
        return { ...this.config };
    }
}
/**
 * Factory function to create a KeyframeDetector.
 *
 * @param config - Optional configuration overrides
 * @returns Configured KeyframeDetector instance
 */
export function createKeyframeDetector(config) {
    return new KeyframeDetector(config);
}
//# sourceMappingURL=keyframe-detector.js.map