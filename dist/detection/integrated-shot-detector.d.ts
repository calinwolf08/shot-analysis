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
 * ## Known Limitations
 *
 * 1. **Single Shooter Assumption**: The detector assumes a single person is
 *    in frame performing the shot. Multiple people in view may cause
 *    incorrect boundary detection.
 *
 * 2. **Camera Angle Dependency**: Detection is optimized for front-facing or
 *    side-profile camera angles. Overhead or severely oblique angles may
 *    reduce accuracy.
 *
 * 3. **Shooting Hand Agnostic**: The current implementation does not differentiate
 *    between left-handed and right-handed shooters. Phase detection uses
 *    averaged wrist positions.
 *
 * 4. **Minimum Shot Duration**: Very fast shots (< ~15 frames at 30fps) may not
 *    be detected reliably due to minimum duration thresholds.
 *
 * 5. **Partial Shots at Boundaries**: Shots that start before or end after the
 *    video clip may have incomplete phase detection.
 *
 * 6. **MediaPipe Confidence Dependency**: Low-confidence landmarks (occlusion,
 *    poor lighting) can affect phase transition detection accuracy.
 *
 * ## Future Improvements
 *
 * 1. **Shooting Hand Detection**: Automatically detect dominant shooting hand
 *    and use shooting-arm-specific landmarks for more accurate phase detection.
 *
 * 2. **Jump Shot vs Set Shot Classification**: Distinguish between jump shots
 *    and set shots using vertical hip displacement.
 *
 * 3. **Multi-Shot Tracking**: Track multiple shooters simultaneously by
 *    associating landmarks with person IDs.
 *
 * 4. **Confidence-Weighted Phase Detection**: Weight phase transitions by
 *    landmark visibility/confidence scores.
 *
 * 5. **Adaptive Thresholds**: Learn optimal thresholds from training data
 *    rather than using fixed defaults.
 *
 * 6. **Ball Detection Integration**: Incorporate ball tracking (when available)
 *    for more precise release frame detection.
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
    /**
     * When true (default), phase ranges are derived from the keyframe
     * algorithm — the same detection scored against the self-labeled corpus —
     * so the runtime identifies the same frames as the labels. The heuristic
     * `phase-detector` output is used as a fallback for any boundary the
     * keyframes don't yield (e.g. an occluded elbow). Set false to use the
     * legacy `phase-detector`-only behaviour.
     */
    readonly useKeyframePhases?: boolean;
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
    private readonly useKeyframePhases;
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