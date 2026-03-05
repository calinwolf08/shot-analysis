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
 * 2. **Async Initialization**: The pose detector requires async initialization.
 *    Use `initialize()` or the factory function before calling analysis methods.
 *
 * 3. **Resource Management**: Call `dispose()` when done to release MediaPipe resources.
 *
 * @see Feature 7.0 - Main Analyzer Integration
 */

import type { AnalysisConfig, ValidatedAnalysisConfig } from "./config";
import { validateConfig } from "./config";
import type { FormProfile, ProfileComparison } from "./profiles/types";
import { ProfileComparisonEngine } from "./profiles/comparison";
import type { PoseDetector } from "./pose/detector";
import { createPoseDetector, type PoseDetectorConfig } from "./pose/factory";
import type { PoseLandmarks as PosePoseLandmarks } from "./pose/types";
import {
  ShotDetector,
  type ShotDetectorConfig,
} from "./detection/integrated-shot-detector";
import {
  MetricOrchestrator,
  createShootingArmCalculators,
  createGuideArmCalculators,
  createBallMetricCalculators,
  createLowerBodyCalculators,
  createPostureCalculators,
  createTimingCalculators,
} from "./metrics";
import { getProfileRegistry, type ProfileRegistry } from "./profiles/registry";
import type { FrameProvider, VideoFrame } from "./providers/types";
import type { PoseLandmarks as MetricsPoseLandmarks, ShotPhase } from "./types";
import type {
  AnalysisResult,
  ShotAnalysis,
  VideoMetadata,
  MetricValue,
} from "./metrics/types";

/**
 * Converts pose detection PoseLandmarks to metrics PoseLandmarks.
 *
 * The pose detection module uses a different landmark format than the metrics module.
 * This function converts between them to allow the pipeline to work.
 */
function convertToMetricsPoseLandmarks(
  pose: PosePoseLandmarks,
  frameIndex: number,
  timestamp: number,
): MetricsPoseLandmarks {
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
  constructor(method: string) {
    super(
      `ShotAnalyzer.${method}() called before initialization. ` +
        `Call initialize() or use createShotAnalyzer() factory function.`,
    );
    this.name = "ShotAnalyzerNotInitializedError";
  }
}

/**
 * Error thrown when initialize() is called on an already initialized analyzer.
 */
export class ShotAnalyzerAlreadyInitializedError extends Error {
  constructor() {
    super(
      "ShotAnalyzer is already initialized. " +
        "Call dispose() first if you need to re-initialize.",
    );
    this.name = "ShotAnalyzerAlreadyInitializedError";
  }
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
 * Internal state for live session processing.
 */
interface LiveSessionState {
  /** Accumulated pose landmarks from processed frames */
  poseLandmarks: PosePoseLandmarks[];
  /** Converted landmarks for metrics extraction */
  metricsLandmarks: MetricsPoseLandmarks[];
  /** Frame metadata for video dimensions */
  frameWidth: number;
  frameHeight: number;
  /** Last timestamp for duration calculation */
  lastTimestamp: number;
  /** Total frames processed in this session */
  totalFrames: number;
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
  private readonly config: ValidatedAnalysisConfig;

  /** Optional initialization options */
  private readonly options: ShotAnalyzerOptions;

  /** Pose detector instance (initialized on initialize()) */
  private poseDetector: PoseDetector | null = null;

  /** Shot detector instance (created on construction) */
  private readonly shotDetector: ShotDetector;

  /** Metric orchestrator with all calculators registered */
  private readonly metricOrchestrator: MetricOrchestrator;

  /** Profile registry for accessing form profiles */
  private readonly profileRegistry: ProfileRegistry;

  /** Profile comparison engine for comparing shots to profiles */
  private readonly comparisonEngine: ProfileComparisonEngine;

  /** Whether the analyzer has been initialized */
  private initialized = false;

  /** Internal state for live session processing */
  private liveSessionState: LiveSessionState | null = null;

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
  constructor(
    config: AnalysisConfig | ValidatedAnalysisConfig,
    options: ShotAnalyzerOptions = {},
  ) {
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
      this.profileRegistry.register(this.config.customProfile as FormProfile);
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
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new ShotAnalyzerAlreadyInitializedError();
    }

    // Create pose detector (async due to model loading)
    this.poseDetector = await createPoseDetector(
      this.options.poseDetectorConfig,
    );

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
  async dispose(): Promise<void> {
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
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Returns the configuration used to create the analyzer.
   *
   * @returns The validated analysis configuration
   */
  getConfig(): ValidatedAnalysisConfig {
    return this.config;
  }

  /**
   * Returns the names of all available form profiles.
   *
   * Includes built-in profiles and any custom profiles that have been registered.
   *
   * @returns Array of profile names, sorted alphabetically
   */
  getProfiles(): string[] {
    return this.profileRegistry.list();
  }

  /**
   * Returns the internal pose detector instance.
   *
   * @internal For testing and advanced use cases only
   * @throws {ShotAnalyzerNotInitializedError} If not initialized
   */
  getPoseDetector(): PoseDetector {
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
  getShotDetector(): ShotDetector {
    return this.shotDetector;
  }

  /**
   * Returns the internal metric orchestrator instance.
   *
   * @internal For testing and advanced use cases only
   */
  getMetricOrchestrator(): MetricOrchestrator {
    return this.metricOrchestrator;
  }

  /**
   * Returns the internal profile registry instance.
   *
   * @internal For testing and advanced use cases only
   */
  getProfileRegistry(): ProfileRegistry {
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
  async analyzeVideo(frameProvider: FrameProvider): Promise<AnalysisResult> {
    if (!this.initialized || !this.poseDetector) {
      throw new ShotAnalyzerNotInitializedError("analyzeVideo");
    }

    // Collect video metadata
    const metadata = frameProvider.getMetadata();
    const fps = frameProvider.getFps();

    // Process all frames through pose detection
    // We collect pose landmarks in the format used by the shot detector
    const allPoseLandmarks: PosePoseLandmarks[] = [];
    // We also collect converted landmarks for metric extraction
    const allMetricsLandmarks: MetricsPoseLandmarks[] = [];
    let totalFrames = 0;

    let frame = await frameProvider.getNextFrame();
    while (frame !== null) {
      // Run pose detection on the frame
      const poseLandmarks = await this.poseDetector.detect(frame);
      if (poseLandmarks) {
        allPoseLandmarks.push(poseLandmarks);
        // Convert to metrics format for later use
        const metricsLandmarks = convertToMetricsPoseLandmarks(
          poseLandmarks,
          frame.frameIndex,
          frame.timestamp,
        );
        allMetricsLandmarks.push(metricsLandmarks);
      }

      totalFrames++;
      frame = await frameProvider.getNextFrame();
    }

    // Build video metadata
    const videoMetadata: VideoMetadata = {
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
        config: this.config as AnalysisConfig,
      };
    }

    // Reset shot detector state for fresh detection
    this.shotDetector.reset();

    // Detect shots from the landmark sequence
    const detectedShots = this.shotDetector.processFrames(allPoseLandmarks);

    // Extract metrics for each detected shot
    const shotAnalyses: ShotAnalysis[] = [];

    for (const shot of detectedShots) {
      // Get landmarks for this shot's frame range
      const shotLandmarks = allMetricsLandmarks.slice(
        shot.frameRange.start,
        shot.frameRange.end + 1,
      );

      // Analyze the shot with metric extraction
      const analysis = this.metricOrchestrator.analyzeShot(
        shot.shotIndex,
        shotLandmarks,
        shot.frameRange,
        shot.phases,
        this.config as AnalysisConfig,
      );

      shotAnalyses.push(analysis);
    }

    return {
      shots: shotAnalyses,
      videoMetadata,
      config: this.config as AnalysisConfig,
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
  async processFrame(frame: VideoFrame): Promise<FrameAnalysis> {
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
    let landmarks: MetricsPoseLandmarks | undefined;
    let currentPhase: ShotPhase | undefined;
    const partialMetrics: Record<string, MetricValue> = {};

    if (poseLandmarks) {
      // Store landmarks for later finalization
      this.liveSessionState.poseLandmarks.push(poseLandmarks);

      // Convert to metrics format
      const metricsLandmarks = convertToMetricsPoseLandmarks(
        poseLandmarks,
        frame.frameIndex,
        frame.timestamp,
      );
      this.liveSessionState.metricsLandmarks.push(metricsLandmarks);
      landmarks = metricsLandmarks;

      // Try to detect current phase using shot detector's incremental processing
      // Note: This is a simplified check - full phase detection happens at finalization
      if (this.liveSessionState.poseLandmarks.length >= 2) {
        // Process frames to see if we're in a shot
        // We use a temporary detector state check
        const tempShots = this.shotDetector.processFrames(
          this.liveSessionState.poseLandmarks,
        );

        // If we have any shots and the current frame is within the last shot's range
        if (tempShots.length > 0) {
          const lastShot = tempShots[tempShots.length - 1];
          if (lastShot && frame.frameIndex <= lastShot.frameRange.end) {
            // Find which phase we're in
            for (const [phaseName, phaseRange] of Object.entries(
              lastShot.phases,
            )) {
              if (
                phaseRange &&
                frame.frameIndex >= phaseRange.startFrame &&
                frame.frameIndex <= phaseRange.endFrame
              ) {
                currentPhase = phaseName as ShotPhase;
                break;
              }
            }
          }
        }
      }
    }

    // Build result object, only including optional properties if they have values
    const result: FrameAnalysis = {
      frameIndex: frame.frameIndex,
      timestamp: frame.timestamp,
      partialMetrics,
    };

    if (landmarks !== undefined) {
      (result as { landmarks: MetricsPoseLandmarks }).landmarks = landmarks;
    }

    if (currentPhase !== undefined) {
      (result as { currentPhase: ShotPhase }).currentPhase = currentPhase;
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
  async finalizeLiveSession(): Promise<AnalysisResult> {
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
        config: this.config as AnalysisConfig,
      };
    }

    const state = this.liveSessionState;

    // Build video metadata
    const videoMetadata: VideoMetadata = {
      width: state.frameWidth,
      height: state.frameHeight,
      duration: state.lastTimestamp,
      fps:
        state.totalFrames > 1
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
        config: this.config as AnalysisConfig,
      };
    }

    // Reset shot detector state for fresh detection
    this.shotDetector.reset();

    // Detect shots from the accumulated landmarks
    const detectedShots = this.shotDetector.processFrames(state.poseLandmarks);

    // Extract metrics for each detected shot
    const shotAnalyses: ShotAnalysis[] = [];

    for (const shot of detectedShots) {
      // Get landmarks for this shot's frame range
      const shotLandmarks = state.metricsLandmarks.slice(
        shot.frameRange.start,
        shot.frameRange.end + 1,
      );

      // Analyze the shot with metric extraction
      const analysis = this.metricOrchestrator.analyzeShot(
        shot.shotIndex,
        shotLandmarks,
        shot.frameRange,
        shot.phases,
        this.config as AnalysisConfig,
      );

      shotAnalyses.push(analysis);
    }

    return {
      shots: shotAnalyses,
      videoMetadata,
      config: this.config as AnalysisConfig,
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
  compareToProfile(
    result: AnalysisResult,
    profileName?: string,
  ): ProfileComparison[] {
    // Use config profile if not specified
    const targetProfile = profileName ?? this.config.profile;

    // Get the profile (throws if not found)
    const profile = this.profileRegistry.get(targetProfile);

    // Compare each shot against the profile
    return result.shots.map((shot) =>
      this.comparisonEngine.compareToProfile(shot, profile),
    );
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
  registerProfile(profile: FormProfile): void {
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
export async function createShotAnalyzer(
  config: AnalysisConfig | ValidatedAnalysisConfig,
  options: ShotAnalyzerOptions = {},
): Promise<ShotAnalyzer> {
  const analyzer = new ShotAnalyzer(config, options);
  await analyzer.initialize();
  return analyzer;
}
