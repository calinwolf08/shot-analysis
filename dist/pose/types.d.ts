/**
 * Type definitions for pose detection in the basketball shot analysis module.
 *
 * This module defines landmark types and constants following the MediaPipe
 * Pose Landmarker specification with 33 body landmarks.
 *
 * @see https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
/**
 * A single pose landmark with 3D position and confidence scores.
 *
 * Coordinates are normalized to the image dimensions (0-1 range).
 * Z coordinate represents relative depth from the camera plane.
 */
export interface Landmark {
    /** Normalized X coordinate (0-1, left to right) */
    readonly x: number;
    /** Normalized Y coordinate (0-1, top to bottom) */
    readonly y: number;
    /** Relative depth (distance from camera plane, normalized) */
    readonly z: number;
    /** Visibility score (0-1) - likelihood the landmark is visible in the image */
    readonly visibility: number;
    /** Confidence score (0-1) - confidence in the landmark detection */
    readonly confidence: number;
}
/**
 * Full pose landmarks for a single frame.
 *
 * Contains all 33 MediaPipe pose landmarks with an overall pose confidence score.
 */
export interface PoseLandmarks {
    /** Array of all 33 landmarks indexed by LANDMARK_INDEX values */
    readonly landmarks: readonly Landmark[];
    /** Overall pose detection confidence (0-1) */
    readonly poseConfidence: number;
}
/**
 * Result of pose detection on a single frame.
 *
 * Returns null when no pose is detected in the frame.
 */
export type PoseDetectionResult = PoseLandmarks | null;
/**
 * MediaPipe Pose Landmarker indices.
 *
 * All 33 landmark indices following the MediaPipe specification.
 * Use these constants for type-safe access to specific body landmarks.
 *
 * @see https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
export declare const LANDMARK_INDEX: {
    readonly NOSE: 0;
    readonly LEFT_EYE_INNER: 1;
    readonly LEFT_EYE: 2;
    readonly LEFT_EYE_OUTER: 3;
    readonly RIGHT_EYE_INNER: 4;
    readonly RIGHT_EYE: 5;
    readonly RIGHT_EYE_OUTER: 6;
    readonly LEFT_EAR: 7;
    readonly RIGHT_EAR: 8;
    readonly MOUTH_LEFT: 9;
    readonly MOUTH_RIGHT: 10;
    readonly LEFT_SHOULDER: 11;
    readonly RIGHT_SHOULDER: 12;
    readonly LEFT_ELBOW: 13;
    readonly RIGHT_ELBOW: 14;
    readonly LEFT_WRIST: 15;
    readonly RIGHT_WRIST: 16;
    readonly LEFT_PINKY: 17;
    readonly RIGHT_PINKY: 18;
    readonly LEFT_INDEX: 19;
    readonly RIGHT_INDEX: 20;
    readonly LEFT_THUMB: 21;
    readonly RIGHT_THUMB: 22;
    readonly LEFT_HIP: 23;
    readonly RIGHT_HIP: 24;
    readonly LEFT_KNEE: 25;
    readonly RIGHT_KNEE: 26;
    readonly LEFT_ANKLE: 27;
    readonly RIGHT_ANKLE: 28;
    readonly LEFT_HEEL: 29;
    readonly RIGHT_HEEL: 30;
    readonly LEFT_FOOT_INDEX: 31;
    readonly RIGHT_FOOT_INDEX: 32;
};
/**
 * Total number of landmarks in MediaPipe Pose Landmarker.
 */
export declare const TOTAL_LANDMARKS = 33;
/**
 * Type representing valid landmark index values (0-32).
 */
export type LandmarkIndexValue = (typeof LANDMARK_INDEX)[keyof typeof LANDMARK_INDEX];
/**
 * Type representing valid landmark names (NOSE, LEFT_SHOULDER, etc.).
 */
export type LandmarkName = keyof typeof LANDMARK_INDEX;
/**
 * Gets a landmark from PoseLandmarks by its index.
 *
 * @param poseLandmarks - The pose landmarks object
 * @param index - The landmark index (0-32)
 * @returns The landmark at the specified index, or undefined if invalid index
 */
export declare function getLandmarkByIndex(poseLandmarks: PoseLandmarks, index: LandmarkIndexValue): Landmark | undefined;
/**
 * Gets a landmark from PoseLandmarks by its name.
 *
 * @param poseLandmarks - The pose landmarks object
 * @param name - The landmark name (e.g., 'LEFT_SHOULDER', 'RIGHT_WRIST')
 * @returns The landmark with the specified name, or undefined if invalid name
 */
export declare function getLandmarkByName(poseLandmarks: PoseLandmarks, name: LandmarkName): Landmark | undefined;
/**
 * Creates an empty landmark with zero values and confidence.
 * Useful for representing undetected or missing landmarks.
 */
export declare function createEmptyLandmark(): Landmark;
/**
 * Creates an empty PoseLandmarks with all zero-confidence landmarks.
 * Useful for representing frames where no pose was detected.
 */
export declare function createEmptyPoseLandmarks(): PoseLandmarks;
/**
 * Checks if a landmark has low visibility (potentially occluded).
 *
 * @param landmark - The landmark to check
 * @param threshold - Visibility threshold (default 0.5)
 * @returns True if the landmark visibility is below the threshold
 */
export declare function isLandmarkOccluded(landmark: Landmark, threshold?: number): boolean;
//# sourceMappingURL=types.d.ts.map