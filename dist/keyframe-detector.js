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
    legBendSearchWindow: 0.7, // Expanded from 0.5 to capture jump shots with late leg bend
    riseSearchWindow: 0.6,
    smoothingWindowSize: 3,
    minConsecutiveFrames: 2,
    kneeVelocityThreshold: 0.5,
    wristVelocityThreshold: -0.002, // Lowered from -0.005 to detect gradual upward motion
    setPointSearchWindow: 0.7,
    setPointMaxElbowAngle: 160,
    releaseSearchWindow: 0.5,
    groundBaselineSearchWindow: 0.4,
    ankleGroundThreshold: 0.015, // Lowered to detect small jumps; landing uses 2x multiplier
    followThroughSearchWindow: 0.5,
};
/**
 * Calculates the angle between three points at a joint (vertex).
 *
 * The angle is measured at the vertex point between the vectors
 * pointing to point A and point B. A straight alignment is ~180 degrees.
 *
 * @param pointA - First landmark position (e.g., shoulder for elbow angle)
 * @param vertex - Vertex landmark position (e.g., elbow)
 * @param pointB - Second landmark position (e.g., wrist for elbow angle)
 * @returns Angle in degrees (0-180). Returns null if any landmark is invalid.
 */
function calculateJointAngle(pointA, vertex, pointB) {
    if (!pointA || !vertex || !pointB) {
        return null;
    }
    // Convert to Point3D for calculation
    const a = { x: pointA.x, y: pointA.y, z: pointA.z };
    const v = { x: vertex.x, y: vertex.y, z: vertex.z };
    const b = { x: pointB.x, y: pointB.y, z: pointB.z };
    // Calculate vectors from vertex to point A and vertex to point B
    const vA = {
        x: a.x - v.x,
        y: a.y - v.y,
        z: a.z - v.z,
    };
    const vB = {
        x: b.x - v.x,
        y: b.y - v.y,
        z: b.z - v.z,
    };
    // Calculate magnitudes
    const magA = Math.sqrt(vA.x * vA.x + vA.y * vA.y + vA.z * vA.z);
    const magB = Math.sqrt(vB.x * vB.x + vB.y * vB.y + vB.z * vB.z);
    // Handle degenerate case (identical points)
    if (magA === 0 || magB === 0) {
        return null;
    }
    // Calculate dot product
    const dotProduct = vA.x * vB.x + vA.y * vB.y + vA.z * vB.z;
    // Calculate cosine of the angle (clamp to handle floating point errors)
    const cosAngle = Math.max(-1, Math.min(1, dotProduct / (magA * magB)));
    // Convert to degrees
    const angleRadians = Math.acos(cosAngle);
    const angleDegrees = angleRadians * (180 / Math.PI);
    return angleDegrees;
}
/**
 * Calculates the angle at the elbow joint (shoulder-elbow-wrist).
 *
 * The angle is measured at the elbow vertex between the shoulder-elbow vector
 * and elbow-wrist vector. A straight arm is ~180 degrees, bent elbow is less.
 *
 * @param shoulder - Shoulder landmark position
 * @param elbow - Elbow landmark position (vertex)
 * @param wrist - Wrist landmark position
 * @returns Angle in degrees (0-180). Returns null if any landmark is invalid.
 */
export function calculateElbowAngle(shoulder, elbow, wrist) {
    return calculateJointAngle(shoulder, elbow, wrist);
}
/**
 * Calculates the wrist flexion angle (forearm-wrist-index finger).
 *
 * This measures the angle at the wrist joint between the forearm direction
 * (elbow to wrist) and the hand direction (wrist to index finger).
 * A straight wrist is ~180 degrees, flexed (snapped) wrist is less.
 *
 * @param elbow - Elbow landmark position
 * @param wrist - Wrist landmark position (vertex)
 * @param indexFinger - Index finger landmark position
 * @returns Angle in degrees (0-180). Returns null if any landmark is invalid.
 */
export function calculateWristAngle(elbow, wrist, indexFinger) {
    return calculateJointAngle(elbow, wrist, indexFinger);
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
 * Gets the elbow angle for the shooting arm in a frame.
 *
 * For set point and release detection, we need the shooting arm elbow angle.
 * This function returns the average of both arms, or whichever is visible.
 *
 * @param frame - The frame with pose landmarks
 * @param visibilityThreshold - Minimum visibility for landmarks to be valid
 * @returns Elbow angle in degrees, or null if neither arm is valid
 */
function getFrameElbowAngle(frame, visibilityThreshold) {
    if (!frame.landmarks) {
        return null;
    }
    const landmarks = frame.landmarks;
    // Get left arm landmarks
    const leftShoulder = landmarks[LANDMARK_INDICES.LEFT_SHOULDER];
    const leftElbow = landmarks[LANDMARK_INDICES.LEFT_ELBOW];
    const leftWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST];
    // Get right arm landmarks
    const rightShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
    const rightElbow = landmarks[LANDMARK_INDICES.RIGHT_ELBOW];
    const rightWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    // Check visibility
    const leftVisible = leftShoulder &&
        leftElbow &&
        leftWrist &&
        leftShoulder.visibility >= visibilityThreshold &&
        leftElbow.visibility >= visibilityThreshold &&
        leftWrist.visibility >= visibilityThreshold;
    const rightVisible = rightShoulder &&
        rightElbow &&
        rightWrist &&
        rightShoulder.visibility >= visibilityThreshold &&
        rightElbow.visibility >= visibilityThreshold &&
        rightWrist.visibility >= visibilityThreshold;
    const leftAngle = leftVisible
        ? calculateElbowAngle(leftShoulder, leftElbow, leftWrist)
        : null;
    const rightAngle = rightVisible
        ? calculateElbowAngle(rightShoulder, rightElbow, rightWrist)
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
 * Gets the wrist flexion angle for the shooting arm in a frame.
 *
 * Wrist flexion angle is measured from elbow -> wrist -> index finger.
 * A straight wrist is ~180 degrees, a flexed/snapped wrist is less.
 *
 * @param frame - The frame with pose landmarks
 * @param visibilityThreshold - Minimum visibility for landmarks to be valid
 * @returns Wrist flexion angle in degrees, or null if neither arm is valid
 */
function getFrameWristAngle(frame, visibilityThreshold) {
    if (!frame.landmarks) {
        return null;
    }
    const landmarks = frame.landmarks;
    // Get left arm landmarks
    const leftElbow = landmarks[LANDMARK_INDICES.LEFT_ELBOW];
    const leftWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST];
    const leftIndex = landmarks[LANDMARK_INDICES.LEFT_INDEX];
    // Get right arm landmarks
    const rightElbow = landmarks[LANDMARK_INDICES.RIGHT_ELBOW];
    const rightWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    const rightIndex = landmarks[LANDMARK_INDICES.RIGHT_INDEX];
    // Check visibility
    const leftVisible = leftElbow &&
        leftWrist &&
        leftIndex &&
        leftElbow.visibility >= visibilityThreshold &&
        leftWrist.visibility >= visibilityThreshold &&
        leftIndex.visibility >= visibilityThreshold;
    const rightVisible = rightElbow &&
        rightWrist &&
        rightIndex &&
        rightElbow.visibility >= visibilityThreshold &&
        rightWrist.visibility >= visibilityThreshold &&
        rightIndex.visibility >= visibilityThreshold;
    const leftAngle = leftVisible
        ? calculateWristAngle(leftElbow, leftWrist, leftIndex)
        : null;
    const rightAngle = rightVisible
        ? calculateWristAngle(rightElbow, rightWrist, rightIndex)
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
 * Detects the "set point" frame - the highest wrist position before release
 * with the elbow still bent.
 *
 * The set point is the "cocking" position where the ball is held at its highest
 * point before the forward/upward release motion. It's characterized by:
 * - Wrist at a local high point (minimum Y in normalized coords)
 * - Elbow still bent (angle less than threshold)
 *
 * @param frames - Array of frames with pose data
 * @param ballStartsUpwardFrame - Frame index where ball starts moving upward
 * @param endFrame - Shot end frame index (inclusive)
 * @param config - Detection configuration
 * @returns Frame index of set point, or null if not detectable
 */
export function detectSetPoint(frames, ballStartsUpwardFrame, endFrame, config = DEFAULT_CONFIG) {
    const shotDuration = endFrame - ballStartsUpwardFrame + 1;
    const searchEndFrame = ballStartsUpwardFrame + Math.floor(shotDuration * config.setPointSearchWindow);
    // Collect wrist Y positions and elbow angles for frames in the search window
    const frameData = [];
    for (const frame of frames) {
        const frameIdx = frame.frameIndex;
        // Only search from ball_starts_upward forward
        if (frameIdx < ballStartsUpwardFrame || frameIdx > searchEndFrame) {
            continue;
        }
        const wristY = getFrameWristY(frame, config.visibilityThreshold);
        const elbowAngle = getFrameElbowAngle(frame, config.visibilityThreshold);
        if (wristY !== null) {
            frameData.push({ frameIndex: frameIdx, wristY, elbowAngle });
        }
    }
    if (frameData.length === 0) {
        return null;
    }
    // Sort by frame index
    frameData.sort((a, b) => a.frameIndex - b.frameIndex);
    // Strategy: Find the frame with minimum wrist Y (highest position)
    // that also has a bent elbow (angle < threshold).
    // If multiple frames have similar wrist Y, prefer the one with more bent elbow.
    let bestFrame = null;
    let minWristY = Infinity;
    for (const data of frameData) {
        // Check if elbow is bent enough (if we have the measurement)
        const elbowBent = data.elbowAngle === null ||
            data.elbowAngle < config.setPointMaxElbowAngle;
        // Look for minimum wrist Y (highest position) with bent elbow
        if (elbowBent && data.wristY < minWristY) {
            minWristY = data.wristY;
            bestFrame = data.frameIndex;
        }
    }
    // If we couldn't find a frame with bent elbow, just use lowest wristY
    if (bestFrame === null && frameData.length > 0) {
        for (const data of frameData) {
            if (data.wristY < minWristY) {
                minWristY = data.wristY;
                bestFrame = data.frameIndex;
            }
        }
    }
    return bestFrame;
}
/**
 * Detects the "release" frame - the frame of maximum wrist flexion (snap).
 *
 * The release is when the wrist snaps and the ball leaves the hand.
 * It's characterized by:
 * - Maximum wrist flexion angle (minimum angle = maximum snap)
 * - Occurs after the set point
 *
 * @param frames - Array of frames with pose data
 * @param setPointFrame - Frame index of the set point
 * @param endFrame - Shot end frame index (inclusive)
 * @param config - Detection configuration
 * @returns Frame index of release, or null if not detectable
 */
export function detectRelease(frames, setPointFrame, endFrame, config = DEFAULT_CONFIG) {
    // Release must occur AFTER set_point, so start from setPointFrame + 1
    const searchStartFrame = setPointFrame + 1;
    const shotDuration = endFrame - setPointFrame + 1;
    const searchEndFrame = setPointFrame + Math.floor(shotDuration * config.releaseSearchWindow);
    // Collect wrist flexion angles for frames in the search window
    const frameData = [];
    for (const frame of frames) {
        const frameIdx = frame.frameIndex;
        // Only search from after set_point forward (release must come after set_point)
        if (frameIdx < searchStartFrame || frameIdx > searchEndFrame) {
            continue;
        }
        const wristAngle = getFrameWristAngle(frame, config.visibilityThreshold);
        if (wristAngle !== null) {
            frameData.push({ frameIndex: frameIdx, wristAngle });
        }
    }
    if (frameData.length === 0) {
        return null;
    }
    // Sort by frame index
    frameData.sort((a, b) => a.frameIndex - b.frameIndex);
    // Find the frame with minimum wrist angle (maximum flexion/snap)
    let releaseFrame = null;
    let minWristAngle = Infinity;
    for (const data of frameData) {
        if (data.wristAngle < minWristAngle) {
            minWristAngle = data.wristAngle;
            releaseFrame = data.frameIndex;
        }
    }
    return releaseFrame;
}
/**
 * Gets the average ankle Y position for a frame.
 *
 * In normalized coordinates, Y=0 is top of frame, Y=1 is bottom.
 * Higher ankle Y means feet are lower (on ground), lower Y means feet are higher (jumping).
 *
 * @param frame - The frame with pose landmarks
 * @param visibilityThreshold - Minimum visibility for landmarks to be valid
 * @returns Average ankle Y, or single ankle Y if one is not visible, or null if neither is valid
 */
function getFrameAnkleY(frame, visibilityThreshold) {
    if (!frame.landmarks) {
        return null;
    }
    const landmarks = frame.landmarks;
    const leftAnkle = landmarks[LANDMARK_INDICES.LEFT_ANKLE];
    const rightAnkle = landmarks[LANDMARK_INDICES.RIGHT_ANKLE];
    const leftVisible = leftAnkle && leftAnkle.visibility >= visibilityThreshold;
    const rightVisible = rightAnkle && rightAnkle.visibility >= visibilityThreshold;
    if (leftVisible && rightVisible) {
        return (leftAnkle.y + rightAnkle.y) / 2;
    }
    else if (leftVisible) {
        return leftAnkle.y;
    }
    else if (rightVisible) {
        return rightAnkle.y;
    }
    return null;
}
/**
 * Establishes the ground baseline for jump detection by finding the local maximum
 * ankle Y position (deepest squat) that has a significant descent AFTER it.
 *
 * This approach handles cases where:
 * - The detected shot start is during walking/movement before the actual stance
 * - The deepest squat (ground position) occurs mid-shot before the jump
 * - The shot starts with low ankle Y before squatting down
 *
 * The baseline is the "ground" reference point from which we measure the jump.
 *
 * Algorithm:
 * 1. Find all local maxima (peaks) in the ankle Y data
 * 2. For each peak, calculate how much the ankle Y drops after it
 * 3. Choose the peak with the largest descent (deepest squat before biggest jump)
 *
 * @param frames - Array of frames with pose data
 * @param startFrame - Shot start frame index (inclusive)
 * @param endFrame - Shot end frame index (inclusive)
 * @param _baselineSearchWindow - DEPRECATED: Not used, kept for API compatibility
 * @param visibilityThreshold - Minimum visibility for landmarks to be valid
 * @returns Ground baseline result with ankle Y and frame index, or null if no valid frames
 */
export function establishGroundBaseline(frames, startFrame, endFrame, _baselineSearchWindow, visibilityThreshold) {
    // Collect all ankle Y values with frame indices
    const ankleData = [];
    for (const frame of frames) {
        const frameIdx = frame.frameIndex;
        if (frameIdx < startFrame || frameIdx > endFrame) {
            continue;
        }
        const ankleY = getFrameAnkleY(frame, visibilityThreshold);
        if (ankleY !== null) {
            ankleData.push({ frameIndex: frameIdx, ankleY });
        }
    }
    if (ankleData.length === 0) {
        return null;
    }
    // Sort by frame index
    ankleData.sort((a, b) => a.frameIndex - b.frameIndex);
    // Find the best local maximum that has a significant descent after it
    // This identifies the "squat" position before the jump
    let bestMaxIdx = -1;
    let bestDescent = -Infinity;
    let bestMaxAnkleY = -Infinity;
    for (let i = 0; i < ankleData.length; i++) {
        const currentY = ankleData[i].ankleY;
        // Find the minimum ankle Y AFTER this point (the jump peak)
        let minAfter = Infinity;
        for (let j = i + 1; j < ankleData.length; j++) {
            if (ankleData[j].ankleY < minAfter) {
                minAfter = ankleData[j].ankleY;
            }
        }
        // Calculate descent (how much ankle Y drops after this point)
        const descent = currentY - minAfter;
        // Track the best (largest) descent that is also a high ankle Y position
        // This ensures we find the squat position (high Y) before the jump (low Y)
        if (descent > bestDescent && currentY > 0) {
            bestDescent = descent;
            bestMaxIdx = i;
            bestMaxAnkleY = currentY;
        }
    }
    // Fallback: if no significant descent found, use the global maximum
    if (bestMaxIdx === -1 || bestDescent <= 0) {
        for (let i = 0; i < ankleData.length; i++) {
            if (ankleData[i].ankleY > bestMaxAnkleY) {
                bestMaxAnkleY = ankleData[i].ankleY;
                bestMaxIdx = i;
            }
        }
    }
    if (bestMaxAnkleY === -Infinity || bestMaxIdx === -1) {
        return null;
    }
    return {
        ankleY: bestMaxAnkleY,
        frameIndex: ankleData[bestMaxIdx].frameIndex,
    };
}
/**
 * Detects the frame with maximum arm extension (arms fully extended).
 *
 * This corresponds to the "arms_fully_extended" keyframe in the Follow-through phase.
 * The detection looks for the frame with the highest elbow angle (closest to 180°)
 * after the release frame.
 *
 * @param frames - Array of frames with pose data
 * @param releaseFrame - Frame index of the release
 * @param endFrame - Shot end frame index (inclusive)
 * @param config - Detection configuration
 * @returns Frame index of maximum arm extension, or null if not detectable
 */
export function detectArmsFullyExtended(frames, releaseFrame, endFrame, config = DEFAULT_CONFIG) {
    const shotDuration = endFrame - releaseFrame + 1;
    const searchEndFrame = releaseFrame + Math.floor(shotDuration * config.followThroughSearchWindow);
    let maxElbowAngle = -Infinity;
    let maxElbowAngleFrame = null;
    for (const frame of frames) {
        const frameIdx = frame.frameIndex;
        // Search from release frame forward (arms extend during follow-through)
        if (frameIdx < releaseFrame || frameIdx > searchEndFrame) {
            continue;
        }
        const elbowAngle = getFrameElbowAngle(frame, config.visibilityThreshold);
        if (elbowAngle !== null && elbowAngle > maxElbowAngle) {
            maxElbowAngle = elbowAngle;
            maxElbowAngleFrame = frameIdx;
        }
    }
    return maxElbowAngleFrame;
}
/**
 * Detects the frame where feet leave the ground (jump detected).
 *
 * This corresponds to the "feet_leave_ground" keyframe.
 * The detection looks for the first frame where ankle Y drops below
 * the established ground baseline by more than the threshold.
 *
 * In normalized coordinates, lower Y = higher in frame = feet off ground.
 *
 * @param frames - Array of frames with pose data
 * @param groundBaselineResult - Ground baseline result from establishGroundBaseline()
 * @param startFrame - Shot start frame index (inclusive, but search starts after baseline frame)
 * @param endFrame - Shot end frame index (inclusive)
 * @param config - Detection configuration
 * @returns Frame index where feet leave ground, or null if no jump detected
 */
export function detectFeetLeaveGround(frames, groundBaselineResult, startFrame, endFrame, config = DEFAULT_CONFIG) {
    // Start searching AFTER the baseline frame (deepest squat)
    // The feet can only "leave ground" after the squat phase
    const searchStart = Math.max(startFrame, groundBaselineResult.frameIndex);
    // Look for first frame where ankle Y is significantly below baseline
    // (lower Y = higher position = feet off ground)
    for (const frame of frames) {
        const frameIdx = frame.frameIndex;
        if (frameIdx < searchStart || frameIdx > endFrame) {
            continue;
        }
        const ankleY = getFrameAnkleY(frame, config.visibilityThreshold);
        if (ankleY !== null) {
            // Check if ankles have risen above baseline (Y decreased)
            const deviation = groundBaselineResult.ankleY - ankleY;
            if (deviation > config.ankleGroundThreshold) {
                return frameIdx;
            }
        }
    }
    // No jump detected - this could be a set shot
    return null;
}
/**
 * Detects the frame where feet land (return to ground).
 *
 * This corresponds to the "feet_land" keyframe.
 * The detection looks for the frame where ankle Y returns to near
 * the established ground baseline after having left the ground.
 *
 * @param frames - Array of frames with pose data
 * @param groundBaselineResult - Ground baseline result from establishGroundBaseline()
 * @param feetLeaveGroundFrame - Frame where feet left ground (or null if no jump)
 * @param endFrame - Shot end frame index (inclusive)
 * @param config - Detection configuration
 * @returns Frame index where feet land, or null if no landing detected
 */
export function detectFeetLand(frames, groundBaselineResult, feetLeaveGroundFrame, endFrame, config = DEFAULT_CONFIG) {
    // If no jump was detected, there's no landing
    if (feetLeaveGroundFrame === null) {
        return null;
    }
    // Use a more forgiving threshold for landing (2x the leave threshold)
    // Landing doesn't need to return to exact baseline - body position shifts
    const landingThreshold = config.ankleGroundThreshold * 2;
    // First, find the jump peak (minimum ankle Y after feet_leave_ground)
    // We need to pass the peak before detecting landing
    let minAnkleY = Infinity;
    let peakFrame = feetLeaveGroundFrame;
    for (const frame of frames) {
        const frameIdx = frame.frameIndex;
        if (frameIdx <= feetLeaveGroundFrame || frameIdx > endFrame) {
            continue;
        }
        const ankleY = getFrameAnkleY(frame, config.visibilityThreshold);
        if (ankleY !== null && ankleY < minAnkleY) {
            minAnkleY = ankleY;
            peakFrame = frameIdx;
        }
    }
    // Now look for landing AFTER the peak
    // Since we already detected feet_leave_ground, we know there was a jump
    // Landing occurs when ankle Y returns to within landingThreshold of baseline
    for (const frame of frames) {
        const frameIdx = frame.frameIndex;
        // Only search after the peak
        if (frameIdx <= peakFrame || frameIdx > endFrame) {
            continue;
        }
        const ankleY = getFrameAnkleY(frame, config.visibilityThreshold);
        if (ankleY !== null) {
            const deviation = groundBaselineResult.ankleY - ankleY;
            // If deviation is within landing threshold, we've landed
            if (deviation <= landingThreshold) {
                return frameIdx;
            }
        }
    }
    // If we never detected landing (maybe still in air at end of shot)
    // but we did detect feet leaving ground, use end frame
    return endFrame;
}
/**
 * KeyframeDetector class for detecting keyframes within basketball shots.
 *
 * Implements keyframe detection for:
 * - Load phase: leg_bend_low_point, ball_low_point
 * - Rise phase: legs_start_extending, ball_starts_upward
 * - Set Point phase: set_point
 * - Release phase: release
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
     * Detects Set Point and Release phase keyframes for a shot.
     *
     * Requires Rise phase keyframes to have been detected first,
     * as set_point detection starts from ball_starts_upward.
     *
     * @param frames - Array of frames with pose data
     * @param ballStartsUpwardFrame - Frame index where ball starts upward (from Rise phase)
     * @param endFrame - Shot end frame index (inclusive)
     * @returns Detection result with keyframes and confidence
     */
    detectSetPointReleaseKeyframes(frames, ballStartsUpwardFrame, endFrame) {
        const keyframes = [];
        // Detect set_point
        const setPointFrame = detectSetPoint(frames, ballStartsUpwardFrame, endFrame, this.config);
        keyframes.push({
            keyframeId: "set_point",
            frameIndex: setPointFrame,
            confidence: setPointFrame !== null ? 0.8 : 0.0,
        });
        // Detect release (requires set_point to be detected first)
        let releaseFrame = null;
        if (setPointFrame !== null) {
            releaseFrame = detectRelease(frames, setPointFrame, endFrame, this.config);
        }
        keyframes.push({
            keyframeId: "release",
            frameIndex: releaseFrame,
            confidence: releaseFrame !== null ? 0.8 : 0.0,
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
     * Detects Follow-through phase keyframes for a shot.
     *
     * Requires previous phases to have been detected first,
     * as Follow-through detection uses the release frame and ground baseline.
     *
     * @param frames - Array of frames with pose data
     * @param releaseFrame - Frame index of the release
     * @param startFrame - Shot start frame index (for ground baseline)
     * @param endFrame - Shot end frame index (inclusive)
     * @returns Detection result with keyframes and confidence
     */
    detectFollowThroughKeyframes(frames, releaseFrame, startFrame, endFrame) {
        const keyframes = [];
        // Establish ground baseline from the area around the release frame
        // This handles shots where the person walks into position at shot start
        // Jump typically happens around set_point/release, so baseline should be local
        const jumpSearchStart = Math.max(startFrame, releaseFrame - 15); // Look up to 15 frames before release
        const groundBaseline = establishGroundBaseline(frames, jumpSearchStart, endFrame, this.config.groundBaselineSearchWindow, this.config.visibilityThreshold);
        // Detect arms_fully_extended
        const armsExtendedFrame = detectArmsFullyExtended(frames, releaseFrame, endFrame, this.config);
        keyframes.push({
            keyframeId: "arms_fully_extended",
            frameIndex: armsExtendedFrame,
            confidence: armsExtendedFrame !== null ? 0.8 : 0.0,
        });
        // Detect feet_leave_ground (only if we have a valid ground baseline)
        // Search from the local area around release, not from shot start
        let feetLeaveGroundFrame = null;
        if (groundBaseline !== null) {
            feetLeaveGroundFrame = detectFeetLeaveGround(frames, groundBaseline, jumpSearchStart, endFrame, this.config);
        }
        keyframes.push({
            keyframeId: "feet_leave_ground",
            frameIndex: feetLeaveGroundFrame,
            // Lower confidence for feet detection since it may be null for set shots
            confidence: feetLeaveGroundFrame !== null ? 0.7 : 0.0,
        });
        // Detect feet_land
        let feetLandFrame = null;
        if (groundBaseline !== null) {
            feetLandFrame = detectFeetLand(frames, groundBaseline, feetLeaveGroundFrame, endFrame, this.config);
        }
        keyframes.push({
            keyframeId: "feet_land",
            frameIndex: feetLandFrame,
            confidence: feetLandFrame !== null ? 0.7 : 0.0,
        });
        // Overall confidence: arms_fully_extended is most important for follow-through
        // feet keyframes may be null for set shots (non-jump shots)
        const armsConfidence = armsExtendedFrame !== null ? 1 : 0;
        const feetConfidence = feetLeaveGroundFrame !== null && feetLandFrame !== null ? 1 : 0.5;
        const overallConfidence = (armsConfidence * 0.6 + feetConfidence * 0.4);
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