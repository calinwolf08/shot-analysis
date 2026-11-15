/**
 * ShotAnalyzer - Main orchestration class for basketball shot form analysis.
 *
 * This class integrates all analysis components (pose detection, shot detection,
 * metric extraction, profile comparison) into a clean public API.
 *
 * ## Usage
 *
 * ```typescript
 * import { ShotAnalyzer, createShotAnalyzer, createConfig } from './analyzer';
 *
 * // Option 1: Using factory function (recommended for most cases)
 * const analyzer = await createShotAnalyzer(createConfig({
 *   shootingHand: 'right',
 *   profile: 'youth-fundamentals',
 * }));
 *
 * // Option 2: Manual instantiation with lazy initialization
 * const analyzer = new ShotAnalyzer(config);
 * await analyzer.initialize();
 *
 * // Use the analyzer...
 * const result = await analyzer.analyzeVideo(frameProvider);
 *
 * // Clean up
 * await analyzer.dispose();
 * ```
 *
 * ## Known Limitations
 *
 * 1. **Single Shooter**: The analyzer assumes a single person is shooting in the frame.
 *    Multiple people may cause incorrect landmark associations.
 *
 * 2. **Camera Angle**: Best results with side-view camera angle. Other angles may
 *    produce less accurate metrics, especially for depth-dependent measurements.
 *
 * 3. **Stationary Shooter**: The analyzer assumes the shooter is relatively stationary
 *    during the shot. Significant lateral movement may affect metric accuracy.
 *
 * 4. **Ball Position Inference**: Since MediaPipe doesn't track objects, ball position
 *    is inferred from hand positions. After release, ball tracking is not available.
 *    Ball-related metrics have lower confidence scores.
 *
 * 5. **Async Initialization**: The pose detector requires async initialization.
 *    Use `initialize()` or the factory function before calling analysis methods.
 *
 * 6. **Resource Management**: Call `dispose()` when done to release MediaPipe resources.
 *
 * ## Future Improvements
 *
 * - Camera angle detection to auto-adjust analysis parameters
 * - Ball tracking model for post-release ball flight analysis
 * - Multi-person support with shooter identification
 * - Support for additional camera angles (front, back, overhead)
 *
 * @see Feature 7.0 - Main Analyzer Integration
 */
import type { AnalysisConfig, ValidatedAnalysisConfig } from "./config";
import type { FormProfile, ProfileComparison } from "./profiles/types";
import type { PoseDetector } from "./pose/detector";
import { type PoseDetectorConfig } from "./pose/factory";
import type { PoseLandmarks as PosePoseLandmarks } from "./pose/types";
import { ShotDetector, type ShotDetectorConfig } from "./detection/integrated-shot-detector";
import { MetricOrchestrator } from "./metrics";
import { type ProfileRegistry } from "./profiles/registry";
import type { FrameProvider, VideoFrame } from "./providers/types";
import type { PoseLandmarks as MetricsPoseLandmarks, ShotPhase } from "./types";
import type { AnalysisResult, VideoMetadata, MetricValue } from "./metrics/types";
/**
 * Error thrown when analyzer methods are called before initialization.
 */
export declare class ShotAnalyzerNotInitializedError extends Error {
    constructor(method: string);
}
/**
 * Error thrown when initialize() is called on an already initialized analyzer.
 */
export declare class ShotAnalyzerAlreadyInitializedError extends Error {
    constructor();
}
/**
 * Configuration for the ShotAnalyzer initialization.
 */
export interface ShotAnalyzerOptions {
    /**
     * Configuration for the pose detector.
     * Passed to createPoseDetector() during initialization.
     */
    readonly poseDetectorConfig?: PoseDetectorConfig;
    /**
     * Configuration for the shot detector.
     */
    readonly shotDetectorConfig?: ShotDetectorConfig;
}
/**
 * Analysis result for a single frame during live processing.
 *
 * Contains the current state of analysis including detected landmarks,
 * current shot phase (if within a shot), and partial metrics accumulated so far.
 */
export interface FrameAnalysis {
    /** Zero-based frame index */
    readonly frameIndex: number;
    /** Timestamp of the frame in milliseconds */
    readonly timestamp: number;
    /** Detected pose landmarks for this frame (undefined if no pose detected) */
    readonly landmarks?: MetricsPoseLandmarks;
    /** Current shot phase if within a shot (undefined if not in a shot) */
    readonly currentPhase?: ShotPhase;
    /** Partial metrics calculated so far (may be updated incrementally) */
    readonly partialMetrics?: Readonly<Record<string, MetricValue>>;
}
/**
 * Main analyzer class that orchestrates all shot analysis components.
 *
 * Integrates pose detection, shot boundary detection, metric extraction,
 * and profile comparison into a unified API.
 *
 * @example
 * ```typescript
 * const analyzer = new ShotAnalyzer(config);
 * await analyzer.initialize();
 *
 * // Get available profiles
 * console.log(analyzer.getProfiles());
 *
 * // Get current configuration
 * console.log(analyzer.getConfig());
 *
 * // Clean up when done
 * await analyzer.dispose();
 * ```
 */
export declare class ShotAnalyzer {
    /** Validated configuration */
    private readonly config;
    /** Optional initialization options */
    private readonly options;
    /** Pose detector instance (initialized on initialize()) */
    private poseDetector;
    /** Shot detector instance (created on construction) */
    private readonly shotDetector;
    /** Metric orchestrator with all calculators registered */
    private readonly metricOrchestrator;
    /** Profile registry for accessing form profiles */
    private readonly profileRegistry;
    /** Profile comparison engine for comparing shots to profiles */
    private readonly comparisonEngine;
    /** Whether the analyzer has been initialized */
    private initialized;
    /** Internal state for live session processing */
    private liveSessionState;
    /**
     * Creates a new ShotAnalyzer instance.
     *
     * The analyzer is not ready for use until `initialize()` is called.
     * For a simpler API, use the `createShotAnalyzer()` factory function.
     *
     * @param config - Analysis configuration (validated on construction)
     * @param options - Optional initialization options
     *
     * @throws {z.ZodError} If config validation fails
     *
     * @example
     * ```typescript
     * const analyzer = new ShotAnalyzer(createConfig({
     *   shootingHand: 'right',
     *   profile: 'youth-fundamentals',
     * }));
     * await analyzer.initialize();
     * ```
     */
    constructor(config: AnalysisConfig | ValidatedAnalysisConfig, options?: ShotAnalyzerOptions);
    /**
     * Initializes the analyzer by setting up the pose detector.
     *
     * This method must be called before using analysis methods.
     * The pose detector requires async initialization due to model loading.
     *
     * @throws {ShotAnalyzerAlreadyInitializedError} If already initialized
     *
     * @example
     * ```typescript
     * const analyzer = new ShotAnalyzer(config);
     * await analyzer.initialize();
     * // Now ready to use
     * ```
     */
    initialize(): Promise<void>;
    /**
     * Releases resources used by the analyzer.
     *
     * Closes the pose detector and resets initialization state.
     * Can be called multiple times safely.
     *
     * @example
     * ```typescript
     * try {
     *   const analyzer = await createShotAnalyzer(config);
     *   // Use analyzer...
     * } finally {
     *   await analyzer.dispose();
     * }
     * ```
     */
    dispose(): Promise<void>;
    /**
     * Returns whether the analyzer has been initialized.
     *
     * @returns true if initialize() has been called and dispose() has not
     */
    isInitialized(): boolean;
    /**
     * Returns the configuration used to create the analyzer.
     *
     * @returns The validated analysis configuration
     */
    getConfig(): ValidatedAnalysisConfig;
    /**
     * Returns the names of all available form profiles.
     *
     * Includes built-in profiles and any custom profiles that have been registered.
     *
     * @returns Array of profile names, sorted alphabetically
     */
    getProfiles(): string[];
    /**
     * Returns the internal pose detector instance.
     *
     * @internal For testing and advanced use cases only
     * @throws {ShotAnalyzerNotInitializedError} If not initialized
     */
    getPoseDetector(): PoseDetector;
    /**
     * Returns the internal shot detector instance.
     *
     * @internal For testing and advanced use cases only
     */
    getShotDetector(): ShotDetector;
    /**
     * Returns the internal metric orchestrator instance.
     *
     * @internal For testing and advanced use cases only
     */
    getMetricOrchestrator(): MetricOrchestrator;
    /**
     * Returns the internal profile registry instance.
     *
     * @internal For testing and advanced use cases only
     */
    getProfileRegistry(): ProfileRegistry;
    /**
     * Analyzes a video and returns complete shot analysis results.
     *
     * Processes all frames through pose detection, detects shots and phases,
     * extracts metrics for each shot, and returns a comprehensive AnalysisResult.
     *
     * @param frameProvider - Provider for video frames to analyze
     * @returns Promise resolving to complete analysis results
     *
     * @throws {ShotAnalyzerNotInitializedError} If analyzer is not initialized
     *
     * @example
     * ```typescript
     * const analyzer = await createShotAnalyzer(config);
     * const frameProvider = new VideoFileProvider('shot.mp4');
     *
     * const result = await analyzer.analyzeVideo(frameProvider);
     * console.log(`Detected ${result.shots.length} shots`);
     *
     * for (const shot of result.shots) {
     *   console.log(`Shot ${shot.shotIndex}: ${shot.overallConfidence * 100}% confidence`);
     * }
     * ```
     */
    analyzeVideo(frameProvider: FrameProvider): Promise<AnalysisResult>;
    /**
     * Runs analysis on an already-extracted pose sequence, skipping MediaPipe
     * pose detection entirely. This is the fast path for the validator/harness:
     * given a `poses.json`-style frame list, it runs shot detection, phase
     * detection and metric extraction and returns the same `AnalysisResult` as
     * {@link analyzeVideo}.
     *
     * Does **not** require {@link initialize} — no pose model is loaded, since
     * the poses are supplied. Frame ordering is by array position (dense pose
     * data, one entry per frame, as `poses.json` provides); each frame's own
     * `frameIndex`/`timestamp` is used for metric timing when present.
     *
     * @param frames - Pre-extracted poses (e.g. `poses.json` `frames`)
     * @param videoMetadata - Video dimensions/fps/frame count for the clip
     * @returns Analysis result with per-shot phases and metrics
     */
    analyzePoses(frames: ReadonlyArray<{
        landmarks?: PosePoseLandmarks["landmarks"] | null;
        poseConfidence?: number;
        frameIndex?: number;
        timestamp?: number;
    } | null>, videoMetadata: VideoMetadata): AnalysisResult;
    /**
     * Shared post-extraction pipeline: shot boundary + phase detection, then
     * metric extraction and orientation per shot. Used by both
     * {@link analyzeVideo} (poses from MediaPipe) and {@link analyzePoses}
     * (poses supplied directly).
     */
    private analyzePoseSequence;
    /**
     * Processes a single video frame for live/incremental analysis.
     *
     * This method enables real-time analysis by processing frames one at a time.
     * Internal state is maintained between calls to track shot progress and
     * accumulate metrics. Use `finalizeLiveSession()` to get the complete
     * analysis result when done.
     *
     * @param frame - The video frame to process
     * @returns Promise resolving to the frame analysis with current state
     *
     * @throws {ShotAnalyzerNotInitializedError} If analyzer is not initialized
     *
     * @example
     * ```typescript
     * const analyzer = await createShotAnalyzer(config);
     *
     * // Process frames as they arrive from camera
     * for await (const frame of cameraStream) {
     *   const analysis = await analyzer.processFrame(frame);
     *   if (analysis.currentPhase) {
     *     console.log(`Current phase: ${analysis.currentPhase}`);
     *   }
     * }
     *
     * // Get final results when done
     * const result = await analyzer.finalizeLiveSession();
     * ```
     */
    processFrame(frame: VideoFrame): Promise<FrameAnalysis>;
    /**
     * Finalizes a live session and returns the complete analysis result.
     *
     * This method completes any partial shot analysis in progress, extracts
     * metrics for all detected shots, and resets the internal state for a
     * new session.
     *
     * @returns Promise resolving to the complete analysis result
     *
     * @throws {ShotAnalyzerNotInitializedError} If analyzer is not initialized
     *
     * @example
     * ```typescript
     * const analyzer = await createShotAnalyzer(config);
     *
     * // Process frames...
     * await analyzer.processFrame(frame1);
     * await analyzer.processFrame(frame2);
     *
     * // Get complete analysis
     * const result = await analyzer.finalizeLiveSession();
     * console.log(`Detected ${result.shots.length} shots`);
     * ```
     */
    finalizeLiveSession(): Promise<AnalysisResult>;
    /**
     * Compares analysis results against a form profile.
     *
     * Returns a ProfileComparison for each shot in the analysis result,
     * comparing the shot's metrics against the specified profile's targets.
     *
     * @param result - The analysis result to compare
     * @param profileName - Name of the profile to compare against (defaults to config profile)
     * @returns Array of ProfileComparison, one for each shot
     *
     * @throws {Error} If the specified profile is not found
     *
     * @example
     * ```typescript
     * const result = await analyzer.analyzeVideo(provider);
     * const comparisons = analyzer.compareToProfile(result);
     *
     * for (const comparison of comparisons) {
     *   console.log(`Shot compared to ${comparison.profile}`);
     *   console.log(`  Pass: ${comparison.summary.passCount}`);
     *   console.log(`  Fail: ${comparison.summary.failCount}`);
     * }
     * ```
     */
    compareToProfile(result: AnalysisResult, profileName?: string): ProfileComparison[];
    /**
     * Registers a custom form profile for use in comparisons.
     *
     * This is a passthrough to the profile registry. The profile will be
     * available for use with `compareToProfile()` immediately after registration.
     *
     * @param profile - The form profile to register
     *
     * @throws {Error} If the profile is invalid (fails validation)
     *
     * @example
     * ```typescript
     * analyzer.registerProfile({
     *   name: "my-custom-profile",
     *   description: "Optimized for tall players",
     *   targets: {
     *     releaseAngle: {
     *       ideal: 55,
     *       acceptable: { min: 50, max: 60 },
     *       priority: "high",
     *       feedback: { tooLow: "Release higher", tooHigh: "Lower your release" }
     *     }
     *   }
     * });
     *
     * const comparisons = analyzer.compareToProfile(result, "my-custom-profile");
     * ```
     */
    registerProfile(profile: FormProfile): void;
}
/**
 * Factory function to create and initialize a ShotAnalyzer in one step.
 *
 * This is the recommended way to create a ShotAnalyzer for most use cases.
 * It handles async initialization automatically.
 *
 * @param config - Analysis configuration
 * @param options - Optional initialization options
 * @returns Promise resolving to an initialized ShotAnalyzer
 *
 * @throws {z.ZodError} If config validation fails
 *
 * @example
 * ```typescript
 * const analyzer = await createShotAnalyzer(createConfig({
 *   shootingHand: 'right',
 *   profile: 'youth-fundamentals',
 * }));
 *
 * // Analyzer is ready to use immediately
 * const result = await analyzer.analyzeVideo(frameProvider);
 *
 * await analyzer.dispose();
 * ```
 */
export declare function createShotAnalyzer(config: AnalysisConfig | ValidatedAnalysisConfig, options?: ShotAnalyzerOptions): Promise<ShotAnalyzer>;
//# sourceMappingURL=analyzer.d.ts.map