/**
 * MediaPipe Browser implementation for pose detection.
 *
 * This module provides a PoseDetector implementation using MediaPipe's
 * Pose Landmarker for browser-based real-time pose analysis.
 *
 * @see https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
import { FilesetResolver, PoseLandmarker, } from "@mediapipe/tasks-vision";
import { DetectorClosedError, PoseDetectionError } from "./detector";
import { TOTAL_LANDMARKS } from "./types";
import { ModelNotFoundError, WasmInitializationError, ModelCreationError, MODEL_PATHS, } from "./mediapipe-node";
/**
 * Runtime delegate for MediaPipe processing.
 * GPU is preferred for better performance in browsers.
 */
export var RuntimeDelegate;
(function (RuntimeDelegate) {
    /** GPU delegate using WebGL */
    RuntimeDelegate["GPU"] = "GPU";
    /** CPU delegate using WASM only */
    RuntimeDelegate["CPU"] = "CPU";
})(RuntimeDelegate || (RuntimeDelegate = {}));
/**
 * Fallback behavior when GPU delegate is requested but WebGL is unavailable.
 */
export var WebGLFallbackBehavior;
(function (WebGLFallbackBehavior) {
    /** Automatically fall back to CPU delegate (default) */
    WebGLFallbackBehavior["AUTO"] = "AUTO";
    /** Throw WebGLNotAvailableError instead of falling back */
    WebGLFallbackBehavior["ERROR"] = "ERROR";
})(WebGLFallbackBehavior || (WebGLFallbackBehavior = {}));
/**
 * Error thrown when WebGL is not available but GPU delegate was requested.
 */
export class WebGLNotAvailableError extends Error {
    constructor() {
        super("WebGL is not available in this browser. Consider using CPU delegate instead.");
        this.name = "WebGLNotAvailableError";
    }
}
/**
 * Configuration options for MediaPipeBrowserDetector.
 */
/** Default CDN location of the tasks-vision WASM runtime. */
const DEFAULT_WASM_BASE_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
/**
 * Detects WebGL support in the browser.
 *
 * @returns true if WebGL is available, false otherwise
 */
export function detectWebGLSupport() {
    if (typeof document === "undefined") {
        return false;
    }
    try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2") ||
            canvas.getContext("webgl") ||
            canvas.getContext("experimental-webgl");
        return gl !== null;
    }
    catch {
        return false;
    }
}
/**
 * MediaPipe-based pose detector for browser environments.
 *
 * This class implements the PoseDetector interface using MediaPipe's
 * Pose Landmarker. It detects 33 body landmarks from video frames.
 * Optimized for browser usage with WebGL acceleration.
 *
 * @example
 * ```typescript
 * const detector = await createMediaPipeBrowserDetector({
 *   modelComplexity: 1,
 *   runningMode: "VIDEO",
 *   delegate: RuntimeDelegate.GPU,
 * });
 *
 * const frame = await provider.getNextFrame();
 * if (frame) {
 *   const result = await detector.detect(frame);
 *   if (result) {
 *     console.log('Pose detected:', result.poseConfidence);
 *   }
 * }
 *
 * await detector.close();
 * ```
 */
export class MediaPipeBrowserDetector {
    landmarker;
    runningMode;
    closed = false;
    /**
     * Private constructor. Use createMediaPipeBrowserDetector() factory function.
     */
    constructor(landmarker, runningMode) {
        this.landmarker = landmarker;
        this.runningMode = runningMode;
    }
    /**
     * Creates a new MediaPipeBrowserDetector instance.
     *
     * @param config - Configuration options
     * @returns Promise resolving to initialized detector
     * @throws {ModelNotFoundError} If the model file cannot be found
     * @throws {WasmInitializationError} If WASM runtime fails to initialize
     * @throws {ModelCreationError} If model creation fails for other reasons
     * @throws {WebGLNotAvailableError} If GPU delegate requested with ERROR fallback and WebGL unavailable
     * @internal
     */
    static async create(config = {}) {
        const { modelComplexity = 1, minDetectionConfidence = 0.5, minTrackingConfidence = 0.5, minPresenceConfidence = 0.5, runningMode = "IMAGE", delegate = RuntimeDelegate.GPU, webglFallback = WebGLFallbackBehavior.AUTO, } = config;
        // Use explicit modelPath if provided, otherwise select based on complexity
        const modelPath = config.modelPath ?? MODEL_PATHS[modelComplexity];
        // Determine actual delegate based on WebGL availability
        let actualDelegate = delegate;
        if (delegate === RuntimeDelegate.GPU) {
            const webglSupported = detectWebGLSupport();
            if (!webglSupported) {
                if (webglFallback === WebGLFallbackBehavior.ERROR) {
                    throw new WebGLNotAvailableError();
                }
                // Auto fallback to CPU when WebGL is not available
                actualDelegate = RuntimeDelegate.CPU;
            }
        }
        let vision;
        try {
            vision = await FilesetResolver.forVisionTasks(config.wasmBasePath ?? DEFAULT_WASM_BASE_PATH);
        }
        catch (error) {
            throw new WasmInitializationError(`Failed to initialize MediaPipe WASM runtime: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
        }
        let landmarker;
        try {
            landmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: modelPath,
                    delegate: actualDelegate,
                },
                runningMode: runningMode,
                numPoses: 1,
                minPoseDetectionConfidence: minDetectionConfidence,
                minTrackingConfidence: minTrackingConfidence,
                minPosePresenceConfidence: minPresenceConfidence,
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Check for model-not-found indicators in the error message
            if (errorMessage.includes("404") ||
                errorMessage.includes("not found") ||
                errorMessage.includes("Failed to load") ||
                errorMessage.includes("Failed to fetch") ||
                errorMessage.includes("ENOENT") ||
                errorMessage.includes("no such file")) {
                throw new ModelNotFoundError(modelPath);
            }
            // For other errors (invalid config, WASM issues, etc.)
            throw new ModelCreationError(`Failed to create pose landmarker: ${errorMessage}`, error instanceof Error ? error : undefined);
        }
        return new MediaPipeBrowserDetector(landmarker, runningMode);
    }
    /**
     * Detects body pose landmarks in a video frame.
     *
     * @param frame - The video frame to analyze
     * @returns Promise resolving to PoseLandmarks or null if no pose detected
     * @throws {DetectorClosedError} If called after close()
     * @throws {PoseDetectionError} If detection fails
     */
    async detect(frame) {
        if (this.closed) {
            throw new DetectorClosedError();
        }
        let result;
        try {
            if (this.runningMode === "VIDEO") {
                // Use detectForVideo for VIDEO mode which requires timestamp
                // Prefer canvas if available (browser), otherwise create ImageData
                if (frame.canvas) {
                    result = this.landmarker.detectForVideo(frame.canvas, frame.timestamp);
                }
                else {
                    // Fallback to ImageData for non-browser frames
                    const imageData = new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height);
                    result = this.landmarker.detectForVideo(imageData, frame.timestamp);
                }
            }
            else {
                // Use detect for IMAGE mode - ImageData works here
                const imageData = new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height);
                result = this.landmarker.detect(imageData);
            }
        }
        catch (error) {
            throw new PoseDetectionError(`Pose detection failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        return this.processLandmarkerResult(result);
    }
    /**
     * Detects body pose landmarks from an HTMLVideoElement.
     *
     * This method is optimized for browser environments where you have
     * direct access to a video element. It avoids the overhead of
     * converting video frames to ImageData.
     *
     * @param video - The HTMLVideoElement to analyze
     * @param timestamp - Timestamp in milliseconds (required for VIDEO mode)
     * @returns Promise resolving to PoseLandmarks or null if no pose detected
     * @throws {DetectorClosedError} If called after close()
     * @throws {PoseDetectionError} If detection fails
     *
     * @example
     * ```typescript
     * const video = document.querySelector('video');
     * const detector = await createMediaPipeBrowserDetector({ runningMode: "VIDEO" });
     *
     * video.addEventListener('timeupdate', async () => {
     *   const result = await detector.detectVideo(video, video.currentTime * 1000);
     *   if (result) {
     *     console.log('Pose detected:', result.poseConfidence);
     *   }
     * });
     * ```
     */
    async detectVideo(video, timestamp) {
        if (this.closed) {
            throw new DetectorClosedError();
        }
        let result;
        try {
            if (this.runningMode === "VIDEO") {
                // Use detectForVideo for VIDEO mode which requires timestamp
                result = this.landmarker.detectForVideo(video, timestamp);
            }
            else {
                // Use detect for IMAGE mode
                result = this.landmarker.detect(video);
            }
        }
        catch (error) {
            throw new PoseDetectionError(`Pose detection failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        return this.processLandmarkerResult(result);
    }
    /**
     * Processes MediaPipe landmarker result into our PoseLandmarks format.
     *
     * @param result - The raw MediaPipe result
     * @returns PoseLandmarks or null if no pose detected
     * @internal
     */
    processLandmarkerResult(result) {
        // No pose detected
        if (!result.landmarks || result.landmarks.length === 0) {
            return null;
        }
        // Use first detected pose
        const poseLandmarks = result.landmarks[0];
        if (!poseLandmarks) {
            return null;
        }
        // Convert to our Landmark format
        const landmarks = poseLandmarks.map((lm) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
            visibility: lm.visibility ?? 0,
            confidence: lm.visibility ?? 0, // Use visibility as confidence
        }));
        // Ensure we have exactly TOTAL_LANDMARKS
        while (landmarks.length < TOTAL_LANDMARKS) {
            landmarks.push({
                x: 0,
                y: 0,
                z: 0,
                visibility: 0,
                confidence: 0,
            });
        }
        // Calculate overall pose confidence as average of landmark visibilities
        const poseConfidence = landmarks.reduce((sum, lm) => sum + lm.visibility, 0) / TOTAL_LANDMARKS;
        const poseLandmarksResult = {
            landmarks,
            poseConfidence,
        };
        return poseLandmarksResult;
    }
    /**
     * Releases resources used by the detector.
     *
     * This method releases all resources including:
     * - MediaPipe PoseLandmarker instance
     * - WebGL context and GPU memory (if GPU delegate was used)
     * - WASM memory allocations
     *
     * The landmarker.close() method internally handles WebGL context cleanup
     * by releasing shader programs, buffers, and textures. No explicit
     * WEBGL_lose_context call is needed as MediaPipe manages this internally.
     *
     * @throws {DetectorClosedError} If called more than once
     */
    async close() {
        if (this.closed) {
            throw new DetectorClosedError();
        }
        this.closed = true;
        // PoseLandmarker.close() internally handles:
        // - Releasing WebGL resources (shaders, buffers, textures)
        // - Freeing WASM memory
        // - Cleaning up any GPU delegate resources
        this.landmarker.close();
    }
}
/**
 * Creates a new MediaPipeBrowserDetector instance.
 *
 * Factory function for creating initialized pose detectors for browser environments.
 * Handles async initialization including model loading and WebGL setup.
 *
 * @param config - Configuration options for the detector
 * @returns Promise resolving to an initialized PoseDetector
 * @throws {ModelNotFoundError} If the model file cannot be found
 * @throws {WasmInitializationError} If WASM initialization fails
 * @throws {ModelCreationError} If model creation fails
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const detector = await createMediaPipeBrowserDetector();
 *
 * // Real-time video processing
 * const videoDetector = await createMediaPipeBrowserDetector({
 *   runningMode: "VIDEO",
 *   delegate: RuntimeDelegate.GPU,
 * });
 *
 * // Lower-end device configuration
 * const mobileDetector = await createMediaPipeBrowserDetector({
 *   modelComplexity: 0,
 *   delegate: RuntimeDelegate.CPU,
 * });
 *
 * try {
 *   const result = await detector.detect(frame);
 *   // Process result...
 * } finally {
 *   await detector.close();
 * }
 * ```
 */
export async function createMediaPipeBrowserDetector(config = {}) {
    return MediaPipeBrowserDetector.create(config);
}
//# sourceMappingURL=mediapipe-browser.js.map