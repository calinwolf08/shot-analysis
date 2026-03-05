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
import { ShotBoundaryDetector, } from "./shot-detector";
import { PhaseDetector } from "./phase-detector";
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
export class ShotDetector {
    boundaryDetector;
    phaseDetector;
    state;
    constructor(config = {}) {
        this.boundaryDetector = new ShotBoundaryDetector(config.boundaryConfig);
        this.phaseDetector = new PhaseDetector(config.phaseConfig);
        this.state = this.createInitialState();
    }
    /**
     * Creates the initial state for the detector.
     */
    createInitialState() {
        return {
            inShot: false,
            shotStartFrame: -1,
            currentShotIndex: 0,
            completedShots: [],
            accumulatedFrames: [],
            frameCounter: 0,
            finalized: false,
        };
    }
    /**
     * Resets the detector state to start fresh.
     * Call this between separate video clips or to restart detection.
     */
    reset() {
        this.state = this.createInitialState();
    }
    /**
     * Processes a batch of frames and returns all detected shots.
     *
     * This is the main method for processing complete video files.
     * For live video processing, use processFrame() instead.
     *
     * @param sequence - Array of PoseLandmarks from consecutive frames
     * @returns Array of detected shots with phase breakdowns
     */
    processFrames(sequence) {
        if (sequence.length < 2) {
            return [];
        }
        // Detect shot boundaries
        const detectedShots = this.boundaryDetector.detectShots(sequence);
        // Convert detected shots to Shot type with phase analysis
        const shots = [];
        for (let i = 0; i < detectedShots.length; i++) {
            const detected = detectedShots[i];
            const shot = this.createShotWithPhases(sequence, detected, i);
            shots.push(shot);
        }
        return shots;
    }
    /**
     * Processes a single frame for incremental/live detection.
     *
     * Call this method for each frame as it arrives from a live video feed.
     * The detector maintains internal state between calls.
     *
     * @param landmarks - PoseLandmarks for the current frame
     * @returns Analysis result for the current frame
     */
    processFrame(landmarks) {
        const frameIndex = this.state.frameCounter;
        this.state.frameCounter++;
        this.state.accumulatedFrames.push(landmarks);
        this.state.finalized = false;
        // Detect boundaries on accumulated frames periodically
        // This allows early detection of shot starts
        const detectedShots = this.boundaryDetector.detectShots(this.state.accumulatedFrames);
        // Update state based on detected shots
        const currentShotIndex = detectedShots.length > 0
            ? detectedShots.length - 1
            : undefined;
        const inShot = detectedShots.length > 0 &&
            detectedShots.some(shot => shot.start.frameIndex <= frameIndex &&
                (shot.end.isPartial || shot.end.frameIndex >= frameIndex));
        // Determine current phase if in a shot
        let currentPhase;
        if (inShot && detectedShots.length > 0) {
            const currentShot = detectedShots[detectedShots.length - 1];
            if (frameIndex >= currentShot.start.frameIndex) {
                // Try to detect phases for the current shot region
                const startFrame = currentShot.start.frameIndex;
                const endFrame = Math.min(frameIndex, this.state.accumulatedFrames.length - 1);
                if (endFrame > startFrame) {
                    const phaseResult = this.phaseDetector.detectPhases(this.state.accumulatedFrames, startFrame, endFrame);
                    // Find which phase the current frame is in
                    for (const [phase, range] of Object.entries(phaseResult.phases)) {
                        if (range && frameIndex >= range.startFrame && frameIndex <= range.endFrame) {
                            currentPhase = phase;
                            break;
                        }
                    }
                }
            }
        }
        return {
            frameIndex,
            landmarks,
            currentPhase,
            inShot,
            currentShotIndex,
        };
    }
    /**
     * Finalizes detection and returns all completed shots.
     *
     * Call this after all frames have been processed to get the final
     * shot list, including any partial shots at the end of the sequence.
     *
     * @returns Array of all detected shots with phase breakdowns
     */
    finalize() {
        if (this.state.accumulatedFrames.length < 2) {
            return [];
        }
        // If already finalized, return cached result
        if (this.state.finalized) {
            return [...this.state.completedShots];
        }
        // Process all accumulated frames
        const shots = this.processFrames(this.state.accumulatedFrames);
        this.state.completedShots = shots;
        this.state.finalized = true;
        return shots;
    }
    /**
     * Returns currently detected shots without finalizing.
     *
     * Use this to get intermediate results during live processing.
     * Note: Results may be incomplete for in-progress shots.
     *
     * @returns Array of currently detected shots
     */
    getDetectedShots() {
        if (this.state.accumulatedFrames.length < 2) {
            return [];
        }
        // Detect completed shots (those with both start and non-partial end)
        const detectedShots = this.boundaryDetector.detectShots(this.state.accumulatedFrames);
        // Only return shots that have completed (non-partial end)
        const completedShots = detectedShots.filter(shot => !shot.end.isPartial);
        return completedShots.map((detected, index) => this.createShotWithPhases(this.state.accumulatedFrames, detected, index));
    }
    /**
     * Creates a Shot object with phase analysis from a detected shot boundary.
     */
    createShotWithPhases(sequence, detected, shotIndex) {
        const startFrame = detected.start.frameIndex;
        const endFrame = detected.end.frameIndex;
        // Detect phases within the shot boundaries
        const phaseResult = this.phaseDetector.detectPhases(sequence, startFrame, endFrame);
        // Calculate overall confidence from boundary and phase detection
        const boundaryConfidence = (detected.start.confidence + detected.end.confidence) / 2;
        const overallConfidence = (boundaryConfidence + phaseResult.confidence) / 2;
        return {
            shotIndex,
            frameRange: {
                start: startFrame,
                end: endFrame,
            },
            phases: phaseResult.phases,
            confidence: overallConfidence,
        };
    }
}
/**
 * Factory function to create a ShotDetector.
 *
 * @param config - Optional configuration options
 * @returns A new ShotDetector instance
 */
export function createShotDetector(config = {}) {
    return new ShotDetector(config);
}
//# sourceMappingURL=integrated-shot-detector.js.map