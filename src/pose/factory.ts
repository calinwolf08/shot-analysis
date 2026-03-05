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
import type { MediaPipeNodeConfig } from "./mediapipe-node";
import type { MediaPipeBrowserConfig } from "./mediapipe-browser";
import { createMediaPipeNodeDetector } from "./mediapipe-node";
import {
  createMediaPipeBrowserDetector,
  RuntimeDelegate,
  WebGLFallbackBehavior,
} from "./mediapipe-browser";

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

  // Browser-specific options

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
export class UnknownRuntimeError extends Error {
  readonly runtime: PoseDetectorRuntime;

  constructor(runtime: PoseDetectorRuntime) {
    super(
      `Unknown runtime "${runtime}". Supported runtimes are: 'node', 'browser', 'auto'.`,
    );
    this.name = "UnknownRuntimeError";
    this.runtime = runtime;
  }
}

/**
 * Detects the current runtime environment.
 *
 * Uses the presence of the `window` global to determine if running
 * in a browser or Node.js environment.
 *
 * @returns 'browser' if window is defined, 'node' otherwise
 */
export function detectRuntime(): "node" | "browser" {
  return typeof window !== "undefined" ? "browser" : "node";
}

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
export async function createPoseDetector(
  config: PoseDetectorConfig = {},
): Promise<PoseDetector> {
  const { runtime = "auto", ...restConfig } = config;

  // Determine the actual runtime to use
  const actualRuntime = runtime === "auto" ? detectRuntime() : runtime;

  switch (actualRuntime) {
    case "node": {
      // Extract only Node.js compatible options (omit undefined values)
      const nodeConfig: MediaPipeNodeConfig = {};

      if (restConfig.modelPath !== undefined) {
        nodeConfig.modelPath = restConfig.modelPath;
      }
      if (restConfig.modelComplexity !== undefined) {
        nodeConfig.modelComplexity = restConfig.modelComplexity;
      }
      if (restConfig.minDetectionConfidence !== undefined) {
        nodeConfig.minDetectionConfidence = restConfig.minDetectionConfidence;
      }
      if (restConfig.minTrackingConfidence !== undefined) {
        nodeConfig.minTrackingConfidence = restConfig.minTrackingConfidence;
      }
      if (restConfig.minPresenceConfidence !== undefined) {
        nodeConfig.minPresenceConfidence = restConfig.minPresenceConfidence;
      }

      return createMediaPipeNodeDetector(nodeConfig);
    }

    case "browser": {
      // Extract browser-compatible options including browser-specific ones (omit undefined values)
      const browserConfig: MediaPipeBrowserConfig = {};

      if (restConfig.modelPath !== undefined) {
        browserConfig.modelPath = restConfig.modelPath;
      }
      if (restConfig.modelComplexity !== undefined) {
        browserConfig.modelComplexity = restConfig.modelComplexity;
      }
      if (restConfig.minDetectionConfidence !== undefined) {
        browserConfig.minDetectionConfidence =
          restConfig.minDetectionConfidence;
      }
      if (restConfig.minTrackingConfidence !== undefined) {
        browserConfig.minTrackingConfidence = restConfig.minTrackingConfidence;
      }
      if (restConfig.minPresenceConfidence !== undefined) {
        browserConfig.minPresenceConfidence = restConfig.minPresenceConfidence;
      }
      if (restConfig.runningMode !== undefined) {
        browserConfig.runningMode = restConfig.runningMode;
      }
      if (restConfig.delegate !== undefined) {
        browserConfig.delegate =
          restConfig.delegate === "GPU"
            ? RuntimeDelegate.GPU
            : RuntimeDelegate.CPU;
      }
      if (restConfig.webglFallback !== undefined) {
        browserConfig.webglFallback =
          restConfig.webglFallback === "AUTO"
            ? WebGLFallbackBehavior.AUTO
            : WebGLFallbackBehavior.ERROR;
      }

      return createMediaPipeBrowserDetector(browserConfig);
    }

    default:
      throw new UnknownRuntimeError(actualRuntime);
  }
}
