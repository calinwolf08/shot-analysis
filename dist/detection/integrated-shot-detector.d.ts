/**
 * Integrated shot detector combining boundary and phase detection.
 *
 * This module provides the ShotDetector class that unifies shot boundary
 * detection and phase identification into a single, easy-to-use interface.
 *
 * Features:
 * - Batch processing via processFrames() for video files
 * - Incremental processing via processFrame() for live video
 * - State management with reset() for continuous processing
 * - Automatic phase detection for each detected shot
 *
 * @see Feature 4.4 - Shot Detector Integration
 */
import type { PoseLandmarks } from "../pose/types";
import type { Shot } from "./types";
import { type ShotBoundaryDetectorConfig } from "./shot-detector";
import { type PhaseDetectorConfig } from "./phase-detector";
/**
 * Configuration options for the integrated shot detector.
 */
export interface ShotDetectorConfig {
    /**
     * Configuration for shot boundary detection.
     */
    readonly boundaryConfig?: ShotBoundaryDetectorConfig;
    /**
     * Configuration for phase detection.
     */
    readonly phaseConfig?: PhaseDetectorConfig;
}
/**
 * Result of processing a single frame.
 * Provides real-time feedback during incremental processing.
 */
export interface FrameAnalysisResult {
    /** Zero-based frame index */
    readonly frameIndex: number;
    /** The landmarks from this frame */
    readonly landmarks?: PoseLandmarks | undefined;
    /** Current detected phase (if in a shot) */
    readonly currentPhase?: string | undefined;
    /** Whether a shot is currently in progress */
    readonly inShot: boolean;
    /** Index of the current shot (if in a shot) */
    readonly currentShotIndex?: number | undefined;
}
/**
 * Integrated shot detector that combines boundary and phase detection.
 *
 * This class provides a unified interface for detecting basketball shots
 * and identifying their phases. It supports both batch processing for
 * video files and incremental processing for live video feeds.
 *
 * @example Batch processing
 * ```typescript
 * const detector = createShotDetector();
 * const landmarks: PoseLandmarks[] = await extractLandmarks(video);
 * const shots = detector.processFrames(landmarks);
 *
 * for (const shot of shots) {
 *   console.log(`Shot ${shot.shotIndex}: frames ${shot.frameRange.start}-${shot.frameRange.end}`);
 *   console.log('Phases:', Object.keys(shot.phases));
 * }
 * ```
 *
 * @example Incremental processing
 * ```typescript
 * const detector = createShotDetector();
 *
 * // Process frames as they arrive
 * for await (const frame of frameStream) {
 *   const result = detector.processFrame(frame);
 *   if (result.inShot) {
 *     console.log(`In shot ${result.currentShotIndex}, phase: ${result.currentPhase}`);
 *   }
 * }
 *
 * // Finalize to get completed shots
 * const shots = detector.finalize();
 * ```
 */
export declare class ShotDetector {
    private readonly boundaryDetector;
    private readonly phaseDetector;
    private state;
    constructor(config?: ShotDetectorConfig);
    /**
     * Creates the initial state for the detector.
     */
    private createInitialState;
    /**
     * Resets the detector state to start fresh.
     * Call this between separate video clips or to restart detection.
     */
    reset(): void;
    /**
     * Processes a batch of frames and returns all detected shots.
     *
     * This is the main method for processing complete video files.
     * For live video processing, use processFrame() instead.
     *
     * @param sequence - Array of PoseLandmarks from consecutive frames
     * @returns Array of detected shots with phase breakdowns
     */
    processFrames(sequence: readonly PoseLandmarks[]): Shot[];
    /**
     * Processes a single frame for incremental/live detection.
     *
     * Call this method for each frame as it arrives from a live video feed.
     * The detector maintains internal state between calls.
     *
     * @param landmarks - PoseLandmarks for the current frame
     * @returns Analysis result for the current frame
     */
    processFrame(landmarks: PoseLandmarks): FrameAnalysisResult;
    /**
     * Finalizes detection and returns all completed shots.
     *
     * Call this after all frames have been processed to get the final
     * shot list, including any partial shots at the end of the sequence.
     *
     * @returns Array of all detected shots with phase breakdowns
     */
    finalize(): Shot[];
    /**
     * Returns currently detected shots without finalizing.
     *
     * Use this to get intermediate results during live processing.
     * Note: Results may be incomplete for in-progress shots.
     *
     * @returns Array of currently detected shots
     */
    getDetectedShots(): Shot[];
    /**
     * Creates a Shot object with phase analysis from a detected shot boundary.
     */
    private createShotWithPhases;
}
/**
 * Factory function to create a ShotDetector.
 *
 * @param config - Optional configuration options
 * @returns A new ShotDetector instance
 */
export declare function createShotDetector(config?: ShotDetectorConfig): ShotDetector;
//# sourceMappingURL=integrated-shot-detector.d.ts.map