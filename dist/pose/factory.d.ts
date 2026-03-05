/**
 * Pose Detector Factory with automatic runtime detection.
 *
 * This module provides a factory function that automatically selects
 * the appropriate pose detector implementation based on the runtime
 * environment (Node.js vs browser).
 *
 * @example
 * ```typescript
 * // Auto-detect runtime
 * const detector = await createPoseDetector();
 *
 * // Explicit runtime selection
 * const nodeDetector = await createPoseDetector({ runtime: 'node' });
 * const browserDetector = await createPoseDetector({ runtime: 'browser' });
 *
 * // With configuration
 * const configuredDetector = await createPoseDetector({
 *   runtime: 'auto',
 *   modelComplexity: 2,
 *   minDetectionConfidence: 0.6,
 * });
 * ```
 */
import type { PoseDetector } from "./detector";
/**
 * Supported runtime environments for pose detection.
 */
export type PoseDetectorRuntime = "node" | "browser" | "auto";
/**
 * Configuration options for createPoseDetector factory.
 *
 * Combines common options with runtime-specific options.
 */
export interface PoseDetectorConfig {
    /**
     * Runtime environment to use.
     * - 'node': Use Node.js MediaPipe implementation
     * - 'browser': Use browser MediaPipe implementation
     * - 'auto': Auto-detect based on environment (default)
     * @default 'auto'
     */
    runtime?: PoseDetectorRuntime;
    /**
     * Path to the pose landmarker model file (.task).
     * Can be a file path or URL.
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
     * Running mode for the pose landmarker (browser only).
     * - "IMAGE": For single frame processing (default)
     * - "VIDEO": For real-time video processing with temporal smoothing
     * @default "IMAGE"
     */
    runningMode?: "IMAGE" | "VIDEO";
    /**
     * Runtime delegate preference (browser only).
     * - "GPU": Use WebGL for better performance (default)
     * - "CPU": Use WASM only (fallback for browsers without WebGL)
     * @default "GPU"
     */
    delegate?: "GPU" | "CPU";
    /**
     * Behavior when GPU delegate is requested but WebGL is not available (browser only).
     * - "AUTO": Automatically fall back to CPU delegate (default)
     * - "ERROR": Throw WebGLNotAvailableError
     * @default "AUTO"
     */
    webglFallback?: "AUTO" | "ERROR";
}
/**
 * Error thrown when an unknown runtime is specified.
 */
export declare class UnknownRuntimeError extends Error {
    readonly runtime: PoseDetectorRuntime;
    constructor(runtime: PoseDetectorRuntime);
}
/**
 * Detects the current runtime environment.
 *
 * Uses the presence of the `window` global to determine if running
 * in a browser or Node.js environment.
 *
 * @returns 'browser' if window is defined, 'node' otherwise
 */
export declare function detectRuntime(): "node" | "browser";
/**
 * Creates a pose detector with automatic runtime detection.
 *
 * This factory function creates the appropriate PoseDetector implementation
 * based on the runtime environment. By default, it auto-detects whether
 * to use the Node.js or browser implementation.
 *
 * @param config - Configuration options including runtime selection
 * @returns Promise resolving to an initialized PoseDetector
 *
 * @throws {UnknownRuntimeError} If an invalid runtime is specified
 * @throws {ModelNotFoundError} If the model file cannot be found
 * @throws {WasmInitializationError} If WASM runtime fails to initialize
 * @throws {ModelCreationError} If model creation fails
 * @throws {WebGLNotAvailableError} If GPU delegate requested with ERROR fallback and WebGL unavailable (browser only)
 *
 * @example
 * ```typescript
 * // Auto-detect runtime (recommended for library code)
 * const detector = await createPoseDetector();
 *
 * // Explicit Node.js runtime
 * const nodeDetector = await createPoseDetector({ runtime: 'node' });
 *
 * // Explicit browser runtime with VIDEO mode
 * const browserDetector = await createPoseDetector({
 *   runtime: 'browser',
 *   runningMode: 'VIDEO',
 *   delegate: 'GPU',
 * });
 *
 * // Custom model configuration
 * const customDetector = await createPoseDetector({
 *   modelComplexity: 2,
 *   minDetectionConfidence: 0.7,
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
export declare function createPoseDetector(config?: PoseDetectorConfig): Promise<PoseDetector>;
//# sourceMappingURL=factory.d.ts.map