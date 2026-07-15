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
    /** Search window as percentage of shot duration for set_point detection. Default: 0.7 */
    readonly setPointSearchWindow?: number;
    /** Maximum elbow angle (degrees) to consider as "bent" for set point. Default: 160 */
    readonly setPointMaxElbowAngle?: number;
    /** Search window as percentage of remaining shot for release detection. Default: 0.5 */
    readonly releaseSearchWindow?: number;
    /** Search window as percentage of shot duration for ground baseline. Default: 0.4 */
    readonly groundBaselineSearchWindow?: number;
    /** Threshold (normalized units) for ankle Y deviation to detect leaving ground. Default: 0.03 */
    readonly ankleGroundThreshold?: number;
    /** Search window as percentage of shot for follow-through detection (from release). Default: 0.5 */
    readonly followThroughSearchWindow?: number;
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
/** One explanation of how a keyframe was determined for a shot. */
export interface KeyframeDiagnostic {
    /** Keyframe id (e.g. "set_point"). */
    readonly keyframe: string;
    /** Chosen frame, or null when not detectable. */
    readonly frame: number | null;
    /** Short method tag (e.g. "elbow-extension", "wristY-peak-fallback"). */
    readonly method: string;
    /** Human-readable reasoning, including the deciding numbers. */
    readonly detail: string;
}
/**
 * Installs (or clears with `null`) a sink that receives a diagnostic for every
 * keyframe the detectors resolve. Set it before running detection and clear it
 * afterwards. Not reentrant — one sink at a time.
 */
export declare function setKeyframeDiagnosticsSink(sink: ((d: KeyframeDiagnostic) => void) | null): void;
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
export declare function calculateElbowAngle(shoulder: TestLandmark | null, elbow: TestLandmark | null, wrist: TestLandmark | null): number | null;
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
export declare function calculateWristAngle(elbow: TestLandmark | null, wrist: TestLandmark | null, indexFinger: TestLandmark | null): number | null;
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
export declare function detectSetPoint_old(frames: readonly Frame[], ballStartsUpwardFrame: number, endFrame: number, config?: Required<KeyframeDetectorConfig>): number | null;
export declare function detectSetPoint(frames: readonly Frame[], ballStartsUpwardFrame: number, endFrame: number, config?: Required<KeyframeDetectorConfig>): number | null;
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
export declare function detectRelease(frames: readonly Frame[], setPointFrame: number, endFrame: number, config?: Required<KeyframeDetectorConfig>): number | null;
/**
 * Result from establishing the ground baseline.
 */
export interface GroundBaselineResult {
    /** The ground baseline ankle Y value (maximum = deepest squat) */
    readonly ankleY: number;
    /** The frame index where the baseline was established */
    readonly frameIndex: number;
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
export declare function establishGroundBaseline(frames: readonly Frame[], startFrame: number, endFrame: number, _baselineSearchWindow: number, visibilityThreshold: number): GroundBaselineResult | null;
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
export declare function detectArmsFullyExtended(frames: readonly Frame[], releaseFrame: number, endFrame: number, config?: Required<KeyframeDetectorConfig>): number | null;
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
export declare function detectFeetLeaveGround(frames: readonly Frame[], groundBaselineResult: GroundBaselineResult, startFrame: number, endFrame: number, config?: Required<KeyframeDetectorConfig>): number | null;
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
export declare function detectFeetLand(frames: readonly Frame[], groundBaselineResult: GroundBaselineResult, feetLeaveGroundFrame: number | null, endFrame: number, config?: Required<KeyframeDetectorConfig>): number | null;
/**
 * KeyframeDetector class for detecting keyframes within basketball shots.
 *
 * Implements keyframe detection for:
 * - Load phase: leg_bend_low_point, ball_low_point
 * - Rise phase: legs_start_extending, ball_starts_upward
 * - Set Point phase: set_point
 * - Release phase: release
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
    detectSetPointReleaseKeyframes(frames: readonly Frame[], ballStartsUpwardFrame: number, endFrame: number): KeyframeDetectionResult;
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
    detectFollowThroughKeyframes(frames: readonly Frame[], releaseFrame: number, startFrame: number, endFrame: number): KeyframeDetectionResult;
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