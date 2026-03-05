/**
 * Type definitions for pose detection in the basketball shot analysis module.
 *
 * This module defines landmark types and constants following the MediaPipe
 * Pose Landmarker specification with 33 body landmarks.
 *
 * @see https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
/**
 * MediaPipe Pose Landmarker indices.
 *
 * All 33 landmark indices following the MediaPipe specification.
 * Use these constants for type-safe access to specific body landmarks.
 *
 * @see https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
export const LANDMARK_INDEX = {
    // Face landmarks
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    // Upper body landmarks
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    // Hand landmarks
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    // Lower body landmarks
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32,
};
/**
 * Total number of landmarks in MediaPipe Pose Landmarker.
 */
export const TOTAL_LANDMARKS = 33;
/**
 * Gets a landmark from PoseLandmarks by its index.
 *
 * @param poseLandmarks - The pose landmarks object
 * @param index - The landmark index (0-32)
 * @returns The landmark at the specified index, or undefined if invalid index
 */
export function getLandmarkByIndex(poseLandmarks, index) {
    if (index < 0 || index >= TOTAL_LANDMARKS) {
        return undefined;
    }
    return poseLandmarks.landmarks[index];
}
/**
 * Gets a landmark from PoseLandmarks by its name.
 *
 * @param poseLandmarks - The pose landmarks object
 * @param name - The landmark name (e.g., 'LEFT_SHOULDER', 'RIGHT_WRIST')
 * @returns The landmark with the specified name, or undefined if invalid name
 */
export function getLandmarkByName(poseLandmarks, name) {
    const index = LANDMARK_INDEX[name];
    return poseLandmarks.landmarks[index];
}
/**
 * Creates an empty landmark with zero values and confidence.
 * Useful for representing undetected or missing landmarks.
 */
export function createEmptyLandmark() {
    return {
        x: 0,
        y: 0,
        z: 0,
        visibility: 0,
        confidence: 0,
    };
}
/**
 * Creates an empty PoseLandmarks with all zero-confidence landmarks.
 * Useful for representing frames where no pose was detected.
 */
export function createEmptyPoseLandmarks() {
    return {
        landmarks: Array.from({ length: TOTAL_LANDMARKS }, () => createEmptyLandmark()),
        poseConfidence: 0,
    };
}
/**
 * Checks if a landmark has low visibility (potentially occluded).
 *
 * @param landmark - The landmark to check
 * @param threshold - Visibility threshold (default 0.5)
 * @returns True if the landmark visibility is below the threshold
 */
export function isLandmarkOccluded(landmark, threshold = 0.5) {
    return landmark.visibility < threshold;
}
//# sourceMappingURL=types.js.map