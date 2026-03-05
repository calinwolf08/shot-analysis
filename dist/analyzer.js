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
import { validateConfig } from "./config";
import { createPoseDetector } from "./pose/factory";
import { ShotDetector, } from "./detection/integrated-shot-detector";
import { MetricOrchestrator, createShootingArmCalculators, createGuideArmCalculators, createBallMetricCalculators, createLowerBodyCalculators, createPostureCalculators, createTimingCalculators, } from "./metrics";
import { getProfileRegistry } from "./profiles/registry";
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
    /** Whether the analyzer has been initialized */
    initialized = false;
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