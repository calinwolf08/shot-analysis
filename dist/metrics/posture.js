/**
 * Posture and alignment metric calculators for basketball shot analysis.
 *
 * This module provides calculators for measuring body posture and alignment:
 * - backPosture: spine angle from vertical (degrees) throughout shot
 * - headTilt: head angle from neutral (degrees) at release and follow-through
 * - shoulderAlignment: shoulder rotation relative to target (degrees) at set point
 * - handCupVsHinge: whether hand cups under or hinges back (categorical) at set point
 *
 * @see Feature 5.6 - Posture & Alignment Metrics
 */
import { getHandednessMapping } from "../config";
import { ShotPhase } from "../detection/types";
import { LANDMARK_INDICES } from "../types";
/**
 * Threshold angle (degrees) to classify hand as "cup" position.
 * Below this angle (fingers pointing back toward elbow), it's a cup.
 */
const CUP_ANGLE_THRESHOLD = 150;
/**
 * Threshold angle (degrees) to classify hand as "hinge" position.
 * Above this angle (fingers pointing forward), it's a hinge.
 */
const HINGE_ANGLE_THRESHOLD = 170;
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
 * Calculates the angle between two 3D vectors in degrees.
 */
function angleBetweenVectors(v1, v2) {
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
    if (mag1 === 0 || mag2 === 0)
        return 0;
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(cosAngle) * (180 / Math.PI);
}
/**
 * Calculates the angle in degrees formed by three points (a-vertex-c).
 * The angle is measured at the vertex point.
 */
function calculateAngle(a, vertex, c) {
    const va = {
        x: a.x - vertex.x,
        y: a.y - vertex.y,
        z: a.z - vertex.z,
    };
    const vc = {
        x: c.x - vertex.x,
        y: c.y - vertex.y,
        z: c.z - vertex.z,
    };
    return angleBetweenVectors(va, vc);
}
/**
 * Calculator for back posture (spine angle from vertical).
 *
 * Measures the angle of the spine from vertical throughout the shot.
 * Uses the midpoint of hips and midpoint of shoulders to define the spine vector.
 * An angle of 0 means perfectly upright, positive angles indicate lean.
 */
export class BackPostureCalculator {
    name = "backPosture";
    description = "Spine angle from vertical (degrees, 0 = perfectly upright)";
    unit = "degrees";
    calculate(context) {
        const { poseLandmarks, phases } = context;
        // Get release phase (primary), fall back to follow-through or set point
        let targetPhase = phases[ShotPhase.Release];
        if (!targetPhase) {
            targetPhase = phases[ShotPhase.FollowThrough];
        }
        if (!targetPhase) {
            targetPhase = phases[ShotPhase.SetPoint];
        }
        if (!targetPhase) {
            return {
                error: "Release, FollowThrough, or SetPoint phase not detected",
            };
        }
        // Get pose at target frame
        const pose = getPoseAtFrame(poseLandmarks, targetPhase.startFrame);
        if (!pose) {
            return { error: "Pose data missing for target frame" };
        }
        // Get spine landmarks
        const leftShoulder = pose.landmarks[LANDMARK_INDICES.LEFT_SHOULDER] ?? null;
        const rightShoulder = pose.landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] ?? null;
        const leftHip = pose.landmarks[LANDMARK_INDICES.LEFT_HIP] ?? null;
        const rightHip = pose.landmarks[LANDMARK_INDICES.RIGHT_HIP] ?? null;
        if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
            return { error: "Required spine landmarks missing" };
        }
        // Calculate midpoints
        const midShoulder = {
            x: (leftShoulder.position.x + rightShoulder.position.x) / 2,
            y: (leftShoulder.position.y + rightShoulder.position.y) / 2,
            z: (leftShoulder.position.z + rightShoulder.position.z) / 2,
        };
        const midHip = {
            x: (leftHip.position.x + rightHip.position.x) / 2,
            y: (leftHip.position.y + rightHip.position.y) / 2,
            z: (leftHip.position.z + rightHip.position.z) / 2,
        };
        // Spine vector (from hip to shoulder, pointing up in body frame)
        // In image coordinates, Y increases downward, so shoulder Y < hip Y for upright
        const spineVector = {
            x: midShoulder.x - midHip.x,
            y: midShoulder.y - midHip.y,
            z: midShoulder.z - midHip.z,
        };
        // Vertical vector (straight up in image coordinates)
        // In normalized image coords, "up" is negative Y direction
        const verticalVector = {
            x: 0,
            y: -1, // Pointing up
            z: 0,
        };
        // Calculate angle from vertical
        const spineAngle = angleBetweenVectors(spineVector, verticalVector);
        // Calculate confidence
        const confidence = calculateMinConfidence([
            leftShoulder,
            rightShoulder,
            leftHip,
            rightHip,
        ]);
        const value = {
            value: Math.round(spineAngle * 10) / 10, // Round to 1 decimal
            unit: this.unit,
            frame: targetPhase.startFrame,
            confidence,
        };
        return { value };
    }
}
/**
 * Calculator for head tilt angle.
 *
 * Measures the angle of head tilt from neutral (horizontal eye line)
 * at release and follow-through phases. Uses eye landmarks to determine
 * head orientation. Positive values indicate tilt to one side.
 */
export class HeadTiltCalculator {
    name = "headTilt";
    description = "Head angle from neutral (degrees) at release/follow-through";
    unit = "degrees";
    calculate(context) {
        const { poseLandmarks, phases } = context;
        // Get release phase (primary), fall back to follow-through
        let targetPhase = phases[ShotPhase.Release];
        if (!targetPhase) {
            targetPhase = phases[ShotPhase.FollowThrough];
        }
        if (!targetPhase) {
            return { error: "Release or FollowThrough phase not detected" };
        }
        // Get pose at target frame
        const pose = getPoseAtFrame(poseLandmarks, targetPhase.startFrame);
        if (!pose) {
            return { error: "Pose data missing for target frame" };
        }
        // Get eye landmarks for tilt calculation
        const leftEye = pose.landmarks[LANDMARK_INDICES.LEFT_EYE] ?? null;
        const rightEye = pose.landmarks[LANDMARK_INDICES.RIGHT_EYE] ?? null;
        if (!leftEye || !rightEye) {
            return { error: "Required eye landmarks missing" };
        }
        // Calculate tilt angle from horizontal
        // In image coordinates, Y increases downward
        // If right eye Y > left eye Y, head is tilted right
        const deltaY = rightEye.position.y - leftEye.position.y;
        const deltaX = rightEye.position.x - leftEye.position.x;
        // Calculate angle using atan2
        // This gives us the angle of the eye line from horizontal
        const tiltRadians = Math.atan2(deltaY, deltaX);
        const tiltDegrees = tiltRadians * (180 / Math.PI);
        // Calculate confidence
        const confidence = calculateMinConfidence([leftEye, rightEye]);
        const value = {
            value: Math.round(tiltDegrees * 10) / 10, // Round to 1 decimal
            unit: this.unit,
            frame: targetPhase.startFrame,
            confidence,
        };
        return { value };
    }
}
/**
 * Calculator for shoulder alignment (rotation relative to target).
 *
 * Measures the rotation of shoulders relative to the target direction
 * (assumed to be straight ahead/camera) at the set point.
 * Uses the Z-coordinate difference between shoulders to determine rotation.
 * An angle of 0 means shoulders are square to the target.
 */
export class ShoulderAlignmentCalculator {
    name = "shoulderAlignment";
    description = "Shoulder rotation relative to target (degrees, 0 = square) at set point";
    unit = "degrees";
    calculate(context) {
        const { poseLandmarks, phases } = context;
        // Get set point phase, fall back to release
        let targetPhase = phases[ShotPhase.SetPoint];
        if (!targetPhase) {
            targetPhase = phases[ShotPhase.Release];
        }
        if (!targetPhase) {
            return { error: "SetPoint or Release phase not detected" };
        }
        // Get pose at target frame
        const pose = getPoseAtFrame(poseLandmarks, targetPhase.startFrame);
        if (!pose) {
            return { error: "Pose data missing for target frame" };
        }
        // Get shoulder landmarks
        const leftShoulder = pose.landmarks[LANDMARK_INDICES.LEFT_SHOULDER] ?? null;
        const rightShoulder = pose.landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] ?? null;
        if (!leftShoulder || !rightShoulder) {
            return { error: "Required shoulder landmarks missing" };
        }
        // Calculate rotation angle from Z-depth difference
        // When shoulders have same Z, they're square to camera
        const deltaZ = rightShoulder.position.z - leftShoulder.position.z;
        const shoulderWidth = rightShoulder.position.x - leftShoulder.position.x;
        // Calculate rotation angle using atan2
        // deltaZ / shoulderWidth gives the tangent of the rotation angle
        const rotationRadians = Math.atan2(deltaZ, shoulderWidth);
        const rotationDegrees = rotationRadians * (180 / Math.PI);
        // Calculate confidence
        const confidence = calculateMinConfidence([leftShoulder, rightShoulder]);
        const value = {
            value: Math.round(rotationDegrees * 10) / 10, // Round to 1 decimal
            unit: this.unit,
            frame: targetPhase.startFrame,
            confidence,
        };
        return { value };
    }
}
/**
 * Calculator for hand cup vs hinge classification.
 *
 * Determines whether the shooting hand cups under the ball or hinges back
 * at the set point. Uses the wrist angle (elbow-wrist-finger) to classify.
 * - Cup: fingers curled back under the ball (angle < 150)
 * - Hinge: wrist bent back, fingers forward (angle > 170)
 * - Neutral: in between
 */
export class HandCupVsHingeCalculator {
    name = "handCupVsHinge";
    description = "Whether hand cups under or hinges back (categorical) at set point";
    unit = "category";
    calculate(context) {
        const { poseLandmarks, phases, config } = context;
        const mapping = getHandednessMapping(config.shootingHand);
        // Get set point phase, fall back to release
        let targetPhase = phases[ShotPhase.SetPoint];
        if (!targetPhase) {
            targetPhase = phases[ShotPhase.Release];
        }
        if (!targetPhase) {
            return { error: "SetPoint or Release phase not detected" };
        }
        // Get pose at target frame
        const pose = getPoseAtFrame(poseLandmarks, targetPhase.startFrame);
        if (!pose) {
            return { error: "Pose data missing for target frame" };
        }
        // Get shooting hand landmarks
        const elbow = pose.landmarks[mapping.shootingElbow] ?? null;
        const wrist = pose.landmarks[mapping.shootingWrist] ?? null;
        // Get finger landmark index based on handedness
        const fingerIndex = config.shootingHand === "right"
            ? LANDMARK_INDICES.RIGHT_INDEX
            : LANDMARK_INDICES.LEFT_INDEX;
        const finger = pose.landmarks[fingerIndex] ?? null;
        if (!elbow || !wrist || !finger) {
            return { error: "Required hand landmarks missing" };
        }
        // Calculate wrist angle (elbow-wrist-finger)
        const wristAngle = calculateAngle(elbow.position, wrist.position, finger.position);
        // Classify based on angle
        let category;
        if (wristAngle < CUP_ANGLE_THRESHOLD) {
            category = "cup";
        }
        else if (wristAngle > HINGE_ANGLE_THRESHOLD) {
            category = "hinge";
        }
        else {
            category = "neutral";
        }
        // Calculate confidence
        const confidence = calculateMinConfidence([elbow, wrist, finger]);
        const value = {
            value: category,
            unit: this.unit,
            frame: targetPhase.startFrame,
            confidence,
        };
        return { value };
    }
}
/**
 * Creates all posture and alignment calculators.
 * Convenience function for registering all calculators with the orchestrator.
 */
export function createPostureCalculators() {
    return [
        new BackPostureCalculator(),
        new HeadTiltCalculator(),
        new ShoulderAlignmentCalculator(),
        new HandCupVsHingeCalculator(),
    ];
}
//# sourceMappingURL=posture.js.map