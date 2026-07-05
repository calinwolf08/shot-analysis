/**
 * Keyframe detection for basketball shot analysis.
 *
 * This module detects specific keyframes within a basketball shot,
 * starting with Load phase keyframes (leg_bend_low_point, ball_low_point).
 *
 * @see Feature 2.0 - Keyframe Detection Algorithms
 */
import type { Frame, TestLandmark, KeyframeId } from "./testing/types";
/**
 * Configuration for keyframe detection.
 */
export interface KeyframeDetectorConfig {
    /** Minimum visibility threshold for landmarks to be considered valid (0-1). Default: 0.5 */
    readonly visibilityThreshold?: number;
    /** Search window as percentage of shot duration for ball_low_point. Default: 0.4 (first 40%) */
    readonly ballLowPointSearchWindow?: number;
    /** Search window as percentage of shot duration for leg_bend_low_point. Default: 0.5 (first 50%) */
    readonly legBendSearchWindow?: number;
}
/**
 * Result of detecting a single keyframe.
 */
export interface DetectedKeyframe {
    /** The keyframe identifier */
    readonly keyframeId: KeyframeId;
    /** Detected frame index, or null if not detectable */
    readonly frameIndex: number | null;
    /** Confidence score for the detection (0-1) */
    readonly confidence: number;
}
/**
 * Result of keyframe detection for a shot.
 */
export interface KeyframeDetectionResult {
    /** All detected keyframes */
    readonly keyframes: readonly DetectedKeyframe[];
    /** Overall confidence for the detection */
    readonly confidence: number;
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
export declare function calculateKneeAngle(hip: TestLandmark | null, knee: TestLandmark | null, ankle: TestLandmark | null): number | null;
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
export declare function detectLegBendLowPoint(frames: readonly Frame[], startFrame: number, endFrame: number, config?: Required<KeyframeDetectorConfig>): number | null;
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
export declare function detectBallLowPoint(frames: readonly Frame[], startFrame: number, endFrame: number, config?: Required<KeyframeDetectorConfig>): number | null;
/**
 * KeyframeDetector class for detecting keyframes within basketball shots.
 *
 * Currently implements Load phase keyframe detection:
 * - leg_bend_low_point: Frame with deepest knee bend
 * - ball_low_point: Frame with lowest ball position (highest wrist Y)
 */
export declare class KeyframeDetector {
    private readonly config;
    constructor(config?: KeyframeDetectorConfig);
    /**
     * Detects Load phase keyframes for a shot.
     *
     * @param frames - Array of frames with pose data
     * @param startFrame - Shot start frame index (inclusive)
     * @param endFrame - Shot end frame index (inclusive)
     * @returns Detection result with keyframes and confidence
     */
    detectLoadPhaseKeyframes(frames: readonly Frame[], startFrame: number, endFrame: number): KeyframeDetectionResult;
    /**
     * Get the current configuration.
     */
    getConfig(): Required<KeyframeDetectorConfig>;
}
/**
 * Factory function to create a KeyframeDetector.
 *
 * @param config - Optional configuration overrides
 * @returns Configured KeyframeDetector instance
 */
export declare function createKeyframeDetector(config?: KeyframeDetectorConfig): KeyframeDetector;
//# sourceMappingURL=keyframe-detector.d.ts.map