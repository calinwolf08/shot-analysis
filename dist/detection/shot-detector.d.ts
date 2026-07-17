/**
 * Shot boundary detection for basketball shot analysis.
 *
 * This module provides the ShotBoundaryDetector class which analyzes
 * sequences of pose landmarks to detect when basketball shots start and end.
 *
 * Detection is based on:
 * - Hand position tracking (wrist Y coordinates)
 * - Velocity thresholds for upward movement
 * - Arm return heuristics for shot completion
 *
 * @see Feature 4.0 - Shot Detection & Phase Identification
 */
import type { PoseLandmarks } from "../pose/types";
/**
 * Configuration options for the shot boundary detector.
 */
export interface ShotBoundaryDetectorConfig {
    /**
     * Minimum upward velocity (negative dy/frame) to trigger shot start.
     * Lower values = more sensitive. Default: 0.015
     */
    readonly velocityThreshold?: number;
    /**
     * Number of frames to use for smoothing landmark positions.
     * Higher values = more noise reduction but more lag. Default: 3
     */
    readonly smoothingWindowSize?: number;
    /**
     * Minimum number of frames for a valid shot.
     * Filters out pump fakes and noise. Default: 20
     */
    readonly minShotDuration?: number;
    /**
     * Number of consecutive frames with upward velocity needed to confirm shot start.
     * Default: 3
     */
    readonly minUpwardFrames?: number;
    /**
     * Threshold for arm return detection (wrist Y position relative to shoulder).
     * When wrist drops below this ratio of shoulder Y, shot ends. Default: 1.0
     */
    readonly armReturnThreshold?: number;
    /**
     * Number of frames to look ahead/behind for confirming boundaries.
     * Default: 3
     */
    readonly confirmationWindow?: number;
}
/**
 * A detected shot boundary (start or end).
 */
export interface DetectedBoundary {
    /** Type of boundary */
    readonly type: "start" | "end";
    /** Frame index where the boundary occurs */
    readonly frameIndex: number;
    /** Confidence score (0-1) for this boundary detection */
    readonly confidence: number;
    /** Whether this boundary is at the edge of the video (partial shot) */
    readonly isPartial: boolean;
}
/**
 * Detected shot with start and end boundaries.
 */
export interface DetectedShot {
    /** Starting boundary */
    readonly start: DetectedBoundary;
    /** Ending boundary */
    readonly end: DetectedBoundary;
    /** Whether the shot starts at frame 0 (video started mid-shot) */
    readonly isPartialStart: boolean;
    /** Whether the shot ends at the last frame (video ended mid-shot) */
    readonly isPartialEnd: boolean;
}
/**
 * Detects shot boundaries (start and end points) from pose landmark sequences.
 *
 * The detector analyzes wrist positions over time to identify:
 * - Shot start: When wrists begin sustained upward movement
 * - Shot end: When the shooting arm returns to a neutral position
 *
 * @example
 * ```typescript
 * const detector = createShotBoundaryDetector({ velocityThreshold: 0.02 });
 * const boundaries = detector.detectBoundaries(landmarkSequence);
 *
 * for (const boundary of boundaries) {
 *   console.log(`Shot ${boundary.type} at frame ${boundary.frameIndex}`);
 * }
 * ```
 */
export declare class ShotBoundaryDetector {
    private readonly config;
    constructor(config?: ShotBoundaryDetectorConfig);
    /**
     * Detects all shot boundaries in a sequence of pose landmarks.
     *
     * @param sequence - Array of PoseLandmarks from consecutive frames
     * @param originalFrameIndices - Optional array mapping sequence indices to original frame numbers
     * @returns Array of detected boundaries (start/end pairs)
     */
    detectBoundaries(sequence: readonly PoseLandmarks[], originalFrameIndices?: readonly number[]): DetectedBoundary[];
    /**
     * Detects shots as paired start/end boundaries.
     *
     * @param sequence - Array of PoseLandmarks from consecutive frames
     * @param originalFrameIndices - Optional array mapping sequence indices to original frame numbers.
     *                               Used to detect pose tracking gaps and reset shot detection.
     * @returns Array of detected shots with boundaries
     */
    detectShots(sequence: readonly PoseLandmarks[], originalFrameIndices?: readonly number[]): DetectedShot[];
    /**
     * Filters detected shots based on orientation metrics.
     * Removes false positives that have body orientations inconsistent with shooting position.
     *
     * Filter criteria:
     * 1. Moderate shoulder separation (0.12-0.20) with positive shoulderDiffX (appearing as back view)
     *    indicates potential false positive. True behind views have larger shoulderSep (>0.20).
     *    The filtering also considers Z-asymmetry: high Z-asymmetry (>0.35) = side view with rotation.
     *
     * 2. Extreme positive Z-depth (>0.55) indicates the left shoulder is much farther from
     *    camera than right - extreme side angle rarely seen in actual shots.
     */
    private filterByOrientation;
    /**
     * Extracts relevant landmark data from each frame.
     */
    private extractFrameData;
    /**
     * Calculates wrist velocity for each frame.
     * Velocity is the change in Y position per frame.
     * Negative velocity = upward movement (lower Y value).
     *
     * Velocities that are too large (indicating pose dropout recovery) are clamped to 0.
     */
    private calculateVelocities;
    private findKneeBendStartFromArmStart;
    /**
     * Finds shot start and end boundaries based on velocity patterns.
     * Uses gap tolerance to handle small breaks in upward motion.
     */
    private findBoundaries;
    /**
     * Finds the actual start of upward motion by looking backward from the current frame.
     * Looks for the first frame where Y starts decreasing.
     */
    private findMotionStart;
    /**
     * After a shot is confirmed, look backward to find if there's a "dip" phase
     * (where the wrist moved down before the upward motion). This is the gather
     * phase of the shot and should be included in the shot boundary.
     *
     * Uses raw (unsmoothed) wrist positions to detect the dip more accurately.
     * Only adjusts the start if there's a significant gap between dip point and
     * upward start (indicating the labeler expects the dip phase to be included).
     */
    private findDipStart;
    /**
     * Checks if the video starts in the middle of a shot motion.
     * Returns true if the first few frames show consistent upward movement.
     */
    private checkStartsInMotion;
    /**
     * Calculates confidence score for a shot start detection.
     */
    private calculateStartConfidence;
    /**
     * Calculates confidence score for a shot end detection.
     */
    private calculateEndConfidence;
    /**
     * Pairs start and end boundaries into complete shots.
     */
    private pairBoundaries;
}
/**
 * Factory function to create a ShotBoundaryDetector.
 *
 * @param config - Optional configuration options
 * @returns A new ShotBoundaryDetector instance
 */
export declare function createShotBoundaryDetector(config?: ShotBoundaryDetectorConfig): ShotBoundaryDetector;
//# sourceMappingURL=shot-detector.d.ts.map