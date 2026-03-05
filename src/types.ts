/**
 * Core type definitions for the basketball shot analysis module.
 * These types are shared across all features.
 */

/**
 * Represents a single video frame with associated metadata.
 */
export interface VideoFrame {
  /** Raw image data in RGBA format */
  readonly data: Uint8ClampedArray;
  /** Frame width in pixels */
  readonly width: number;
  /** Frame height in pixels */
  readonly height: number;
  /** Timestamp of the frame in milliseconds from video start */
  readonly timestamp: number;
  /** Zero-based frame index */
  readonly frameIndex: number;
}

/**
 * Metadata about the video source.
 */
export interface FrameMetadata {
  /** Frame width in pixels */
  readonly width: number;
  /** Frame height in pixels */
  readonly height: number;
  /** Total duration of the video in milliseconds (undefined for live streams) */
  readonly duration?: number;
  /** Frames per second */
  readonly fps: number;
  /** Total number of frames (undefined for live streams) */
  readonly totalFrames?: number;
}

/**
 * Handedness configuration for the shooter.
 */
export type ShootingHand = "left" | "right";

/**
 * Unit for timing outputs.
 */
export type TimingUnit = "frames" | "ms" | "percent";

/**
 * Range specification with optional min/max bounds.
 */
export interface NumericRange {
  readonly min: number;
  readonly max: number;
}

/**
 * A 3D point with x, y, z coordinates.
 */
export interface Point3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * A 2D point with x, y coordinates.
 */
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/**
 * A single pose landmark with position and confidence.
 */
export interface PoseLandmark {
  /** Normalized position (0-1 relative to frame dimensions) */
  readonly position: Point3D;
  /** Visibility score (0-1) */
  readonly visibility: number;
  /** Presence confidence score (0-1) */
  readonly presence: number;
}

/**
 * MediaPipe pose landmark indices.
 * Reference: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
export const LANDMARK_INDICES = {
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
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
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
} as const;

/**
 * Number of landmarks in MediaPipe pose detection.
 */
export const TOTAL_LANDMARKS = 33;

/**
 * Landmark index type for type-safe landmark access.
 */
export type LandmarkIndex =
  (typeof LANDMARK_INDICES)[keyof typeof LANDMARK_INDICES];

/**
 * Full pose landmarks for a single frame.
 */
export interface PoseLandmarks {
  /** Array of all 33 landmarks */
  readonly landmarks: readonly PoseLandmark[];
  /** Overall pose detection confidence (0-1) */
  readonly confidence: number;
  /** Timestamp of the frame this pose was detected in */
  readonly timestamp: number;
  /** Frame index this pose was detected in */
  readonly frameIndex: number;
}

/**
 * Shot phase enumeration.
 */
export type ShotPhase =
  | "gather"
  | "load"
  | "rise"
  | "setPoint"
  | "release"
  | "followThrough";

/**
 * Frame range for a phase or shot.
 */
export interface FrameRange {
  readonly startFrame: number;
  readonly endFrame: number;
}

/**
 * A single metric value with context.
 */
export interface MetricValue {
  /** The calculated value */
  readonly value: number | string;
  /** Unit of measurement */
  readonly unit: string;
  /** Frame index where this metric was measured */
  readonly frame: number;
  /** Confidence score for this metric (0-1) */
  readonly confidence: number;
}

/**
 * Comparison status for a metric against a profile target.
 */
export type ComparisonStatus = "pass" | "fail" | "warning";

/**
 * Priority level for metrics in a profile.
 */
export type MetricPriority = "high" | "medium" | "low";
