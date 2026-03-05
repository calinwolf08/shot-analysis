/**
 * MediaPipe Browser implementation for pose detection.
 *
 * This module provides a PoseDetector implementation using MediaPipe's
 * Pose Landmarker for browser-based real-time pose analysis.
 *
 * @see https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
import type { VideoFrame } from "../providers/types";
import type { PoseDetector } from "./detector";
import type { PoseDetectionResult } from "./types";
/**
 * Runtime delegate for MediaPipe processing.
 * GPU is preferred for better performance in browsers.
 */
export declare enum RuntimeDelegate {
    /** GPU delegate using WebGL */
    GPU = "GPU",
    /** CPU delegate using WASM only */
    CPU = "CPU"
}
/**
 * Fallback behavior when GPU delegate is requested but WebGL is unavailable.
 */
export declare enum WebGLFallbackBehavior {
    /** Automatically fall back to CPU delegate (default) */
    AUTO = "AUTO",
    /** Throw WebGLNotAvailableError instead of falling back */
    ERROR = "ERROR"
}
/**
 * Error thrown when WebGL is not available but GPU delegate was requested.
 */
export declare class WebGLNotAvailableError extends Error {
    constructor();
}
/**
 * Configuration options for MediaPipeBrowserDetector.
 */
export interface MediaPipeBrowserConfig {
    /**
     * Path to the pose landmarker model file (.task).
     * Can be a file path or URL.
     * @default DEFAULT_MODEL_PATH
     */
    modelPath?: string;
    /**
     * Model complexity (0-2). Higher values are more accurate but slower.
     * - 0: Lite model
     * - 1: Full model
     * - 2: Heavy model
     * @default 1
     */
    modelComplexity?: 0 | 1 | 2;
    /**
     * Minimum confidence value for a pose detection to be considered successful.
     * Value between 0 and 1.
     * @default 0.5
     */
    minDetectionConfidence?: number;
    /**
     * Minimum confidence value for pose tracking to be considered successful.
     * Value between 0 and 1.
     * @default 0.5
     */
    minTrackingConfidence?: number;
    /**
     * Minimum confidence value for pose presence to be considered valid.
     * Value between 0 and 1.
     * @default 0.5
     */
    minPresenceConfidence?: number;
    /**
     * Running mode for the pose landmarker.
     * - "IMAGE": For single frame processing (default)
     * - "VIDEO": For real-time video processing with temporal smoothing
     * @default "IMAGE"
     */
    runningMode?: "IMAGE" | "VIDEO";
    /**
     * Runtime delegate preference.
     * - GPU: Use WebGL for better performance (default)
     * - CPU: Use WASM only (fallback for browsers without WebGL)
     * @default RuntimeDelegate.GPU
     */
    delegate?: RuntimeDelegate;
    /**
     * Behavior when GPU delegate is requested but WebGL is not available.
     * - AUTO: Automatically fall back to CPU delegate (default)
     * - ERROR: Throw WebGLNotAvailableError
     * @default WebGLFallbackBehavior.AUTO
     */
    webglFallback?: WebGLFallbackBehavior;
}
/**
 * Detects WebGL support in the browser.
 *
 * @returns true if WebGL is available, false otherwise
 */
export declare function detectWebGLSupport(): boolean;
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
export declare class MediaPipeBrowserDetector implements PoseDetector {
    private readonly landmarker;
    private readonly runningMode;
    private closed;
    /**
     * Private constructor. Use createMediaPipeBrowserDetector() factory function.
     */
    private constructor();
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
    static create(config?: MediaPipeBrowserConfig): Promise<MediaPipeBrowserDetector>;
    /**
     * Detects body pose landmarks in a video frame.
     *
     * @param frame - The video frame to analyze
     * @returns Promise resolving to PoseLandmarks or null if no pose detected
     * @throws {DetectorClosedError} If called after close()
     * @throws {PoseDetectionError} If detection fails
     */
    detect(frame: VideoFrame): Promise<PoseDetectionResult>;
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
    detectVideo(video: HTMLVideoElement, timestamp: number): Promise<PoseDetectionResult>;
    /**
     * Processes MediaPipe landmarker result into our PoseLandmarks format.
     *
     * @param result - The raw MediaPipe result
     * @returns PoseLandmarks or null if no pose detected
     * @internal
     */
    private processLandmarkerResult;
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
    close(): Promise<void>;
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
export declare function createMediaPipeBrowserDetector(config?: MediaPipeBrowserConfig): Promise<PoseDetector>;
//# sourceMappingURL=mediapipe-browser.d.ts.map