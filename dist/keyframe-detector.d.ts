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
    /** Search window as percentage of shot duration for Rise phase detection. Default: 0.6 */
    readonly riseSearchWindow?: number;
    /** Window size for smoothing velocity calculations. Default: 3 */
    readonly smoothingWindowSize?: number;
    /** Minimum consecutive frames with positive velocity to confirm knee extension. Default: 2 */
    readonly minConsecutiveFrames?: number;
    /** Minimum knee angle velocity (degrees per frame) to detect extension. Default: 0.5 */
    readonly kneeVelocityThreshold?: number;
    /** Minimum wrist Y velocity (normalized units per frame) to detect upward motion. Default: -0.005 */
    readonly wristVelocityThreshold?: number;
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
 * Calculates velocity (frame-to-frame change) from a sequence of values.
 *
 * @param values - Array of numeric values
 * @returns Array of velocities (one element shorter than input)
 */
export declare function calculateVelocity(values: number[]): number[];
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
export declare function calculateSmoothedVelocity(values: number[], windowSize: number): number[];
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
export declare function detectLegsStartExtending(frames: readonly Frame[], legBendLowPointFrame: number, endFrame: number, config?: Required<KeyframeDetectorConfig>): number | null;
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
export declare function detectBallStartsUpward(frames: readonly Frame[], ballLowPointFrame: number, endFrame: number, config?: Required<KeyframeDetectorConfig>): number | null;
/**
 * KeyframeDetector class for detecting keyframes within basketball shots.
 *
 * Implements keyframe detection for:
 * - Load phase: leg_bend_low_point, ball_low_point
 * - Rise phase: legs_start_extending, ball_starts_upward
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
    detectRisePhaseKeyframes(frames: readonly Frame[], legBendLowPointFrame: number, ballLowPointFrame: number, endFrame: number): KeyframeDetectionResult;
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