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
import { validateConfig } from "./config";
import { ProfileComparisonEngine } from "./profiles/comparison";
import { createPoseDetector } from "./pose/factory";
import { ShotDetector, } from "./detection/integrated-shot-detector";
import { MetricOrchestrator, createShootingArmCalculators, createGuideArmCalculators, createBallMetricCalculators, createLowerBodyCalculators, createPostureCalculators, createTimingCalculators, } from "./metrics";
import { getProfileRegistry } from "./profiles/registry";
/**
 * Converts pose detection PoseLandmarks to metrics PoseLandmarks.
 *
 * The pose detection module uses a different landmark format than the metrics module.
 * This function converts between them to allow the pipeline to work.
 */
function convertToMetricsPoseLandmarks(pose, frameIndex, timestamp) {
    return {
        landmarks: pose.landmarks.map((l) => ({
            position: { x: l.x, y: l.y, z: l.z },
            visibility: l.visibility,
            presence: l.confidence,
        })),
        confidence: pose.poseConfidence,
        timestamp,
        frameIndex,
    };
}
/**
 * Error thrown when analyzer methods are called before initialization.
 */
export class ShotAnalyzerNotInitializedError extends Error {
    constructor(method) {
        super(`ShotAnalyzer.${method}() called before initialization. ` +
            `Call initialize() or use createShotAnalyzer() factory function.`);
        this.name = "ShotAnalyzerNotInitializedError";
    }
}
/**
 * Error thrown when initialize() is called on an already initialized analyzer.
 */
export class ShotAnalyzerAlreadyInitializedError extends Error {
    constructor() {
        super("ShotAnalyzer is already initialized. " +
            "Call dispose() first if you need to re-initialize.");
        this.name = "ShotAnalyzerAlreadyInitializedError";
    }
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
export class ShotAnalyzer {
    /** Validated configuration */
    config;
    /** Optional initialization options */
    options;
    /** Pose detector instance (initialized on initialize()) */
    poseDetector = null;
    /** Shot detector instance (created on construction) */
    shotDetector;
    /** Metric orchestrator with all calculators registered */
    metricOrchestrator;
    /** Profile registry for accessing form profiles */
    profileRegistry;
    /** Profile comparison engine for comparing shots to profiles */
    comparisonEngine;
    /** Whether the analyzer has been initialized */
    initialized = false;
    /** Internal state for live session processing */
    liveSessionState = null;
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
    constructor(config, options = {}) {
        // Validate configuration - throws ZodError if invalid
        this.config = validateConfig(config);
        this.options = options;
        // Create shot detector (synchronous, no async init needed)
        this.shotDetector = new ShotDetector(options.shotDetectorConfig);
        // Create metric orchestrator with all calculators
        this.metricOrchestrator = new MetricOrchestrator([
            ...createShootingArmCalculators(),
            ...createGuideArmCalculators(),
            ...createBallMetricCalculators(),
            ...createLowerBodyCalculators(),
            ...createPostureCalculators(),
            ...createTimingCalculators(),
        ]);
        // Get profile registry (singleton)
        this.profileRegistry = getProfileRegistry();
        // Create comparison engine
        this.comparisonEngine = new ProfileComparisonEngine();
        // Register custom profile if provided
        // Cast is safe because config.FormProfile and profiles/types.FormProfile are structurally identical
        if (this.config.customProfile) {
            this.profileRegistry.register(this.config.customProfile);
        }
    }
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
    async initialize() {
        if (this.initialized) {
            throw new ShotAnalyzerAlreadyInitializedError();
        }
        // Create pose detector (async due to model loading)
        this.poseDetector = await createPoseDetector(this.options.poseDetectorConfig);
        this.initialized = true;
    }
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
    async dispose() {
        if (this.poseDetector) {
            await this.poseDetector.close();
            this.poseDetector = null;
        }
        this.initialized = false;
    }
    /**
     * Returns whether the analyzer has been initialized.
     *
     * @returns true if initialize() has been called and dispose() has not
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * Returns the configuration used to create the analyzer.
     *
     * @returns The validated analysis configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Returns the names of all available form profiles.
     *
     * Includes built-in profiles and any custom profiles that have been registered.
     *
     * @returns Array of profile names, sorted alphabetically
     */
    getProfiles() {
        return this.profileRegistry.list();
    }
    /**
     * Returns the internal pose detector instance.
     *
     * @internal For testing and advanced use cases only
     * @throws {ShotAnalyzerNotInitializedError} If not initialized
     */
    getPoseDetector() {
        if (!this.poseDetector) {
            throw new ShotAnalyzerNotInitializedError("getPoseDetector");
        }
        return this.poseDetector;
    }
    /**
     * Returns the internal shot detector instance.
     *
     * @internal For testing and advanced use cases only
     */
    getShotDetector() {
        return this.shotDetector;
    }
    /**
     * Returns the internal metric orchestrator instance.
     *
     * @internal For testing and advanced use cases only
     */
    getMetricOrchestrator() {
        return this.metricOrchestrator;
    }
    /**
     * Returns the internal profile registry instance.
     *
     * @internal For testing and advanced use cases only
     */
    getProfileRegistry() {
        return this.profileRegistry;
    }
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
    async analyzeVideo(frameProvider) {
        if (!this.initialized || !this.poseDetector) {
            throw new ShotAnalyzerNotInitializedError("analyzeVideo");
        }
        // Collect video metadata
        const metadata = frameProvider.getMetadata();
        const fps = frameProvider.getFps();
        // Process all frames through pose detection
        // We collect pose landmarks in the format used by the shot detector
        const allPoseLandmarks = [];
        // We also collect converted landmarks for metric extraction
        const allMetricsLandmarks = [];
        let totalFrames = 0;
        let frame = await frameProvider.getNextFrame();
        let framesWithPose = 0;
        let framesWithoutPose = 0;
        while (frame !== null) {
            // Run pose detection on the frame
            const poseLandmarks = await this.poseDetector.detect(frame);
            if (poseLandmarks) {
                framesWithPose++;
                allPoseLandmarks.push(poseLandmarks);
                // Convert to metrics format for later use
                const metricsLandmarks = convertToMetricsPoseLandmarks(poseLandmarks, frame.frameIndex, frame.timestamp);
                allMetricsLandmarks.push(metricsLandmarks);
            }
            else {
                framesWithoutPose++;
            }
            totalFrames++;
            // Log progress every 30 frames
            if (totalFrames % 30 === 0) {
                console.log(`[Analyzer] Processed ${totalFrames} frames, poses detected: ${framesWithPose}`);
            }
            frame = await frameProvider.getNextFrame();
        }
        console.log(`[Analyzer] Total frames: ${totalFrames}, with pose: ${framesWithPose}, without pose: ${framesWithoutPose}`);
        // Build video metadata
        const videoMetadata = {
            width: metadata.width,
            height: metadata.height,
            ...(metadata.duration !== undefined && { duration: metadata.duration }),
            fps,
            totalFrames,
        };
        // Handle empty video or no landmarks
        if (allPoseLandmarks.length < 2) {
            return {
                shots: [],
                videoMetadata,
                config: this.config,
            };
        }
        // Reset shot detector state for fresh detection
        this.shotDetector.reset();
        console.log(`[Analyzer] Running shot detection on ${allPoseLandmarks.length} pose frames...`);
        // Detect shots from the landmark sequence
        const detectedShots = this.shotDetector.processFrames(allPoseLandmarks);
        console.log(`[Analyzer] Shot detection complete, found ${detectedShots.length} shots`);
        // Extract metrics for each detected shot
        const shotAnalyses = [];
        for (const shot of detectedShots) {
            // Get landmarks for this shot's frame range
            const shotLandmarks = allMetricsLandmarks.slice(shot.frameRange.start, shot.frameRange.end + 1);
            // Analyze the shot with metric extraction
            const analysis = this.metricOrchestrator.analyzeShot(shot.shotIndex, shotLandmarks, shot.frameRange, shot.phases, this.config);
            shotAnalyses.push(analysis);
        }
        return {
            shots: shotAnalyses,
            videoMetadata,
            config: this.config,
        };
    }
    // =========================================================================
    // Live Session Support Methods
    // =========================================================================
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
    async processFrame(frame) {
        if (!this.initialized || !this.poseDetector) {
            throw new ShotAnalyzerNotInitializedError("processFrame");
        }
        // Initialize live session state if not already started
        if (!this.liveSessionState) {
            this.liveSessionState = {
                poseLandmarks: [],
                metricsLandmarks: [],
                frameWidth: frame.width,
                frameHeight: frame.height,
                lastTimestamp: 0,
                totalFrames: 0,
            };
        }
        // Run pose detection on the frame
        const poseLandmarks = await this.poseDetector.detect(frame);
        // Update session state
        this.liveSessionState.lastTimestamp = frame.timestamp;
        this.liveSessionState.totalFrames++;
        // Build the frame analysis result
        let landmarks;
        let currentPhase;
        const partialMetrics = {};
        if (poseLandmarks) {
            // Store landmarks for later finalization
            this.liveSessionState.poseLandmarks.push(poseLandmarks);
            // Convert to metrics format
            const metricsLandmarks = convertToMetricsPoseLandmarks(poseLandmarks, frame.frameIndex, frame.timestamp);
            this.liveSessionState.metricsLandmarks.push(metricsLandmarks);
            landmarks = metricsLandmarks;
            // Try to detect current phase using shot detector's incremental processing
            // Note: This is a simplified check - full phase detection happens at finalization
            if (this.liveSessionState.poseLandmarks.length >= 2) {
                // Process frames to see if we're in a shot
                // We use a temporary detector state check
                const tempShots = this.shotDetector.processFrames(this.liveSessionState.poseLandmarks);
                // If we have any shots and the current frame is within the last shot's range
                if (tempShots.length > 0) {
                    const lastShot = tempShots[tempShots.length - 1];
                    if (lastShot && frame.frameIndex <= lastShot.frameRange.end) {
                        // Find which phase we're in
                        for (const [phaseName, phaseRange] of Object.entries(lastShot.phases)) {
                            if (phaseRange &&
                                frame.frameIndex >= phaseRange.startFrame &&
                                frame.frameIndex <= phaseRange.endFrame) {
                                currentPhase = phaseName;
                                break;
                            }
                        }
                    }
                }
            }
        }
        // Build result object, only including optional properties if they have values
        const result = {
            frameIndex: frame.frameIndex,
            timestamp: frame.timestamp,
            partialMetrics,
        };
        if (landmarks !== undefined) {
            result.landmarks = landmarks;
        }
        if (currentPhase !== undefined) {
            result.currentPhase = currentPhase;
        }
        return result;
    }
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
    async finalizeLiveSession() {
        if (!this.initialized || !this.poseDetector) {
            throw new ShotAnalyzerNotInitializedError("finalizeLiveSession");
        }
        // Handle case where no frames were processed
        if (!this.liveSessionState) {
            return {
                shots: [],
                videoMetadata: {
                    width: 0,
                    height: 0,
                    fps: 30, // Default fps when no frames
                    totalFrames: 0,
                },
                config: this.config,
            };
        }
        const state = this.liveSessionState;
        // Build video metadata
        const videoMetadata = {
            width: state.frameWidth,
            height: state.frameHeight,
            duration: state.lastTimestamp,
            fps: state.totalFrames > 1
                ? state.totalFrames / (state.lastTimestamp / 1000)
                : 30,
            totalFrames: state.totalFrames,
        };
        // Reset state for next session
        this.liveSessionState = null;
        // Handle empty session or too few landmarks
        if (state.poseLandmarks.length < 2) {
            return {
                shots: [],
                videoMetadata,
                config: this.config,
            };
        }
        // Reset shot detector state for fresh detection
        this.shotDetector.reset();
        // Detect shots from the accumulated landmarks
        const detectedShots = this.shotDetector.processFrames(state.poseLandmarks);
        // Extract metrics for each detected shot
        const shotAnalyses = [];
        for (const shot of detectedShots) {
            // Get landmarks for this shot's frame range
            const shotLandmarks = state.metricsLandmarks.slice(shot.frameRange.start, shot.frameRange.end + 1);
            // Analyze the shot with metric extraction
            const analysis = this.metricOrchestrator.analyzeShot(shot.shotIndex, shotLandmarks, shot.frameRange, shot.phases, this.config);
            shotAnalyses.push(analysis);
        }
        return {
            shots: shotAnalyses,
            videoMetadata,
            config: this.config,
        };
    }
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
    compareToProfile(result, profileName) {
        // Use config profile if not specified
        const targetProfile = profileName ?? this.config.profile;
        // Get the profile (throws if not found)
        const profile = this.profileRegistry.get(targetProfile);
        // Compare each shot against the profile
        return result.shots.map((shot) => this.comparisonEngine.compareToProfile(shot, profile));
    }
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
    registerProfile(profile) {
        this.profileRegistry.register(profile);
    }
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
export async function createShotAnalyzer(config, options = {}) {
    const analyzer = new ShotAnalyzer(config, options);
    await analyzer.initialize();
    return analyzer;
}
//# sourceMappingURL=analyzer.js.map