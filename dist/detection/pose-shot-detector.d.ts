/**
 * Pose-based shot boundary detection for basketball shot analysis.
 *
 * This module provides shot detection using biomechanical signals:
 * - Shot start: Knee bend + hip drop (loading phase)
 * - Shot end: Arm extension + landing (follow-through phase)
 * - Orientation: Hip-to-shoulder alignment angle
 *
 * @see Feature 10.0 - Algorithm Iteration
 * @see Task 10.1 - Shot Boundary Detection Algorithm
 */
import type { PoseData, Orientation } from "../testing/types";
import type { Point3D } from "../types";
/**
 * Configuration options for the pose-based shot detector.
 */
export interface PoseShotDetectorConfig {
    /** Minimum knee angle change (degrees) to indicate knee bend. Default: 15 */
    readonly kneeBendThreshold?: number;
    /** Minimum hip Y drop (normalized) to indicate loading. Default: 0.015 */
    readonly hipDropThreshold?: number;
    /** Wrist Y position relative to shoulder for max arm extension. Default: -0.15 */
    readonly armExtensionThreshold?: number;
    /** Minimum shot duration in frames. Default: 15 */
    readonly minShotDuration?: number;
    /** Maximum shot duration in frames. Default: 90 */
    readonly maxShotDuration?: number;
    /** Smoothing window size for position data. Default: 3 */
    readonly smoothingWindowSize?: number;
    /** Minimum pose confidence to consider a frame valid. Default: 0.3 */
    readonly minPoseConfidence?: number;
    /** Number of consecutive frames to confirm a signal. Default: 3 */
    readonly confirmationFrames?: number;
}
/**
 * A detected shot with frame boundaries.
 */
export interface DetectedShot {
    /** Start frame index (0-based, inclusive) */
    readonly startFrame: number;
    /** End frame index (0-based, inclusive) */
    readonly endFrame: number;
    /** Confidence score for this detection (0-1) */
    readonly confidence: number;
}
/**
 * Result of running detection on pose data.
 */
export interface DetectionResult {
    /** Array of detected shots */
    readonly shots: readonly DetectedShot[];
    /** Detected camera orientation */
    readonly orientation: Orientation | "unknown";
}
/**
 * Internal frame analysis data.
 */
interface FrameAnalysis {
    readonly frameIndex: number;
    readonly leftKneeAngle: number;
    readonly rightKneeAngle: number;
    readonly avgKneeAngle: number;
    readonly hipY: number;
    readonly leftWristY: number;
    readonly rightWristY: number;
    readonly avgWristY: number;
    readonly leftShoulderY: number;
    readonly rightShoulderY: number;
    readonly avgShoulderY: number;
    readonly wristToShoulderDiff: number;
    readonly confidence: number;
}
/**
 * Calculates knee angle from hip-knee-ankle landmarks.
 *
 * The angle is measured at the knee joint, between the hip and ankle.
 * A straight leg has an angle of ~180 degrees.
 * A bent knee has a smaller angle (e.g., 90-120 degrees when squatting).
 *
 * @param hip - Hip landmark position
 * @param knee - Knee landmark position (vertex of the angle)
 * @param ankle - Ankle landmark position
 * @returns Angle in degrees (0-180)
 */
export declare function calculateKneeAngle(hip: Point3D, knee: Point3D, ankle: Point3D): number;
/**
 * Detects shot start frame using knee bend + hip drop signals.
 *
 * Shot loading is characterized by:
 * - Knee angle decreasing (knees bending)
 * - Hip Y position increasing (hip dropping down)
 *
 * @param analyses - Array of frame analyses
 * @param config - Detection configuration
 * @returns Frame indices where shot starts are detected
 */
export declare function detectShotStart(analyses: readonly FrameAnalysis[], config: Required<PoseShotDetectorConfig>): number[];
/**
 * Detects shot end frame using arm extension + landing signals.
 *
 * Shot completion is characterized by:
 * - Wrist reaching maximum height (minimum Y value)
 * - Knees starting to bend again (landing)
 *
 * @param analyses - Array of frame analyses
 * @param startFrame - Frame index where the shot started
 * @param config - Detection configuration
 * @returns Frame index where shot ends, or -1 if not found
 */
export declare function detectShotEnd(analyses: readonly FrameAnalysis[], startFrame: number, config: Required<PoseShotDetectorConfig>): number;
/**
 * Detects camera orientation from hip-to-shoulder alignment.
 *
 * Orientation is determined by analyzing the X positions of shoulders and hips:
 * - front: Left landmarks are clearly to the left of right landmarks
 * - side-left: Shooter's left side visible (shoulders aligned, left closer)
 * - side-right: Shooter's right side visible (shoulders aligned, right closer)
 * - front-left: Between front and side-left
 * - front-right: Between front and side-right
 *
 * @param poseData - Pose data to analyze
 * @returns Detected orientation or 'unknown'
 */
export declare function detectOrientation(poseData: PoseData): Orientation | "unknown";
/**
 * Detects basketball shots in pose data.
 *
 * This is the main entry point for shot detection. It combines signals from:
 * - Knee bend and hip drop for shot start detection
 * - Arm extension and landing for shot end detection
 *
 * @param poseData - Pose data loaded from a poses.json file
 * @param config - Optional configuration overrides
 * @returns Detection result with shots array and orientation
 *
 * @example
 * ```typescript
 * import { detectShots } from './pose-shot-detector';
 * import { loadPoseData } from '../testing/loader';
 *
 * const poseData = loadPoseData('test-data/video1/poses.json');
 * const result = detectShots(poseData.data);
 *
 * for (const shot of result.shots) {
 *   console.log(`Shot: frames ${shot.startFrame}-${shot.endFrame}`);
 * }
 * ```
 */
export declare function detectShots(poseData: PoseData, config?: PoseShotDetectorConfig): DetectionResult;
/**
 * Creates a pose-based shot detector function with the given configuration.
 *
 * @param config - Detection configuration
 * @returns A function that takes PoseData and returns DetectionResult
 */
export declare function createPoseShotDetector(config?: PoseShotDetectorConfig): (poseData: PoseData) => DetectionResult;
export {};
//# sourceMappingURL=pose-shot-detector.d.ts.map