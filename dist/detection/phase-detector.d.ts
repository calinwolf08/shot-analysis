/**
 * Phase identification for basketball shot analysis.
 *
 * This module provides the PhaseDetector class which analyzes sequences of
 * pose landmarks to identify the 6 phases of a basketball shot:
 * - Gather: Ball received, preparing to shoot
 * - Load: Lowering into legs, ball may dip
 * - Rise: Legs extending, ball moving upward
 * - SetPoint: Ball at highest point before release
 * - Release: Shooting arm extends, wrist snaps
 * - FollowThrough: Arm fully extended, held
 *
 * Phase transitions are based on:
 * - Hip vertical position (load detection)
 * - Knee angle (load to rise transition)
 * - Wrist height peaks (set point)
 * - Hand separation velocity (release)
 * - Arm extension angle (follow-through)
 *
 * @see Feature 4.0 - Shot Detection & Phase Identification
 */
import type { PoseLandmarks } from "../pose/types";
import { type ShotPhases } from "./types";
/**
 * Configuration options for the phase detector.
 */
export interface PhaseDetectorConfig {
    /**
     * Number of frames to use for smoothing landmark positions.
     * Higher values = more noise reduction but more lag. Default: 3
     */
    readonly smoothingWindowSize?: number;
    /**
     * Threshold for hysteresis to prevent phase flickering.
     * Phases won't transition unless the signal exceeds this threshold. Default: 0.01
     */
    readonly hysteresisThreshold?: number;
    /**
     * Minimum number of frames for a phase to be considered valid.
     * Default: 2
     */
    readonly minPhaseDuration?: number;
    /**
     * Threshold for detecting hand separation during release.
     * Distance between index fingers normalized to shoulder width. Default: 0.15
     */
    readonly handSeparationThreshold?: number;
    /**
     * Threshold for hip drop detection during load phase.
     * Normalized change in hip Y position. Default: 0.015
     */
    readonly hipDropThreshold?: number;
    /**
     * Threshold for wrist velocity to detect upward motion during rise.
     * Negative value (upward in image coords). Default: -0.01
     */
    readonly wristVelocityThreshold?: number;
}
/**
 * Result of phase detection on a shot sequence.
 */
export interface PhaseDetectionResult {
    /** Detected phases with frame ranges */
    readonly phases: ShotPhases;
    /** Overall confidence score for the detection (0-1) */
    readonly confidence: number;
}
/**
 * Identifies shot phases from pose landmark sequences.
 *
 * The detector uses biomechanical indicators to identify when each phase
 * of a basketball shot occurs:
 *
 * - **Gather**: Detected when hands come together and wrists start moving
 * - **Load**: Detected by hip dropping (increased Y) and knee bending
 * - **Rise**: Detected by sustained upward wrist movement and knee extension
 * - **SetPoint**: Detected at wrist height peak (minimum Y value)
 * - **Release**: Detected by rapid hand separation
 * - **FollowThrough**: Detected after release with shooting arm extended
 *
 * @example
 * ```typescript
 * const detector = createPhaseDetector();
 * const landmarks = await getPoseLandmarks(videoFrames);
 * const result = detector.detectPhases(landmarks, shotStart, shotEnd);
 *
 * console.log('Phases detected:', Object.keys(result.phases));
 * console.log('Set point at frame:', result.phases[ShotPhase.SetPoint]?.startFrame);
 * ```
 */
export declare class PhaseDetector {
    private readonly config;
    constructor(config?: PhaseDetectorConfig);
    /**
     * Detects all shot phases within a frame range.
     *
     * @param sequence - Array of PoseLandmarks from consecutive frames
     * @param startFrame - Starting frame index (inclusive)
     * @param endFrame - Ending frame index (inclusive)
     * @returns Phase detection result with frame ranges and confidence
     */
    detectPhases(sequence: readonly PoseLandmarks[], startFrame: number, endFrame: number): PhaseDetectionResult;
    /**
     * Analyzes each frame to extract relevant metrics for phase detection.
     */
    private analyzeFrames;
    /**
     * Calculates knee angle from hip-knee-ankle landmarks.
     */
    private calculateKneeAngle;
    /**
     * Identifies phases from analyzed frame data.
     */
    private identifyPhases;
    /**
     * Finds key biomechanical points in the sequence.
     */
    private findKeyPoints;
    /**
     * Assigns phase ranges based on key points and transitions.
     */
    private assignPhases;
    /**
     * Calculates overall confidence for the phase detection.
     */
    private calculateOverallConfidence;
}
/**
 * Factory function to create a PhaseDetector.
 *
 * @param config - Optional configuration options
 * @returns A new PhaseDetector instance
 */
export declare function createPhaseDetector(config?: PhaseDetectorConfig): PhaseDetector;
//# sourceMappingURL=phase-detector.d.ts.map