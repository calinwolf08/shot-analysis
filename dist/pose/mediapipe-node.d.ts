/**
 * MediaPipe Node.js implementation for pose detection.
 *
 * This module provides a PoseDetector implementation using MediaPipe's
 * Pose Landmarker for server-side and CLI video analysis.
 *
 * @see https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
import type { VideoFrame } from "../providers/types";
import type { PoseDetector } from "./detector";
import type { PoseDetectionResult } from "./types";
/**
 * Model paths for each complexity level.
 * - 0: Lite model - fastest, lower accuracy
 * - 1: Full model - balanced speed/accuracy
 * - 2: Heavy model - slowest, highest accuracy
 */
export declare const MODEL_PATHS: Record<0 | 1 | 2, string>;
/**
 * Default path to the MediaPipe pose landmarker model.
 * Uses the full model (complexity 1) for best balance of speed and accuracy.
 */
export declare const DEFAULT_MODEL_PATH: string;
/**
 * Error thrown when the model file cannot be found or loaded.
 */
export declare class ModelNotFoundError extends Error {
    readonly modelPath: string;
    constructor(modelPath: string);
}
/**
 * Error thrown when MediaPipe WASM runtime fails to initialize.
 */
export declare class WasmInitializationError extends Error {
    readonly originalError: Error | undefined;
    constructor(message: string, originalError?: Error);
}
/**
 * Error thrown when model creation fails due to configuration issues.
 */
export declare class ModelCreationError extends Error {
    readonly originalError: Error | undefined;
    constructor(message: string, originalError?: Error);
}
/**
 * Configuration options for MediaPipeNodeDetector.
 */
export interface MediaPipeNodeConfig {
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
}
/**
 * MediaPipe-based pose detector for Node.js environments.
 *
 * This class implements the PoseDetector interface using MediaPipe's
 * Pose Landmarker. It detects 33 body landmarks from video frames.
 *
 * @example
 * ```typescript
 * const detector = await createMediaPipeNodeDetector({
 *   modelComplexity: 1,
 *   minDetectionConfidence: 0.6,
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
export declare class MediaPipeNodeDetector implements PoseDetector {
    private readonly landmarker;
    private closed;
    /**
     * Private constructor. Use createMediaPipeNodeDetector() factory function.
     */
    private constructor();
    /**
     * Creates a new MediaPipeNodeDetector instance.
     *
     * @param config - Configuration options
     * @returns Promise resolving to initialized detector
     * @throws {ModelNotFoundError} If the model file cannot be found
     * @throws {WasmInitializationError} If WASM runtime fails to initialize
     * @throws {ModelCreationError} If model creation fails for other reasons
     * @internal
     */
    static create(config?: MediaPipeNodeConfig): Promise<MediaPipeNodeDetector>;
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
     * Releases resources used by the detector.
     *
     * @throws {DetectorClosedError} If called more than once
     */
    close(): Promise<void>;
}
/**
 * Creates a new MediaPipeNodeDetector instance.
 *
 * Factory function for creating initialized pose detectors.
 * Handles async initialization including model loading.
 *
 * @param config - Configuration options for the detector
 * @returns Promise resolving to an initialized PoseDetector
 * @throws {ModelNotFoundError} If the model file cannot be found
 * @throws {PoseDetectionError} If initialization fails
 *
 * @example
 * ```typescript
 * const detector = await createMediaPipeNodeDetector({
 *   modelComplexity: 1,
 *   minDetectionConfidence: 0.6,
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
export declare function createMediaPipeNodeDetector(config?: MediaPipeNodeConfig): Promise<PoseDetector>;
//# sourceMappingURL=mediapipe-node.d.ts.map