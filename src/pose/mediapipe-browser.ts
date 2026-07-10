/**
 * MediaPipe Browser implementation for pose detection.
 *
 * This module provides a PoseDetector implementation using MediaPipe's
 * Pose Landmarker for browser-based real-time pose analysis.
 *
 * @see https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */

import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { VideoFrame } from "../providers/types";
import type { PoseDetector } from "./detector";
import { DetectorClosedError, PoseDetectionError } from "./detector";
import type { Landmark, PoseDetectionResult, PoseLandmarks } from "./types";
import { TOTAL_LANDMARKS } from "./types";
import {
  ModelNotFoundError,
  WasmInitializationError,
  ModelCreationError,
  MODEL_PATHS,
} from "./mediapipe-node";

/**
 * Runtime delegate for MediaPipe processing.
 * GPU is preferred for better performance in browsers.
 */
export enum RuntimeDelegate {
  /** GPU delegate using WebGL */
  GPU = "GPU",
  /** CPU delegate using WASM only */
  CPU = "CPU",
}

/**
 * Fallback behavior when GPU delegate is requested but WebGL is unavailable.
 */
export enum WebGLFallbackBehavior {
  /** Automatically fall back to CPU delegate (default) */
  AUTO = "AUTO",
  /** Throw WebGLNotAvailableError instead of falling back */
  ERROR = "ERROR",
}

/**
 * Error thrown when WebGL is not available but GPU delegate was requested.
 */
export class WebGLNotAvailableError extends Error {
  constructor() {
    super(
      "WebGL is not available in this browser. Consider using CPU delegate instead.",
    );
    this.name = "WebGLNotAvailableError";
  }
}

/**
 * Configuration options for MediaPipeBrowserDetector.
 */
/** Default CDN location of the tasks-vision WASM runtime. */
const DEFAULT_WASM_BASE_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

export interface MediaPipeBrowserConfig {
  /**
   * Path to the pose landmarker model file (.task).
   * Can be a file path or URL.
   * @default DEFAULT_MODEL_PATH
   */
  modelPath?: string;

  /**
   * Base path/URL of the MediaPipe tasks-vision WASM assets.
   * Point at a locally-hosted copy for offline-first apps.
   * @default the jsdelivr CDN for @mediapipe/tasks-vision
   */
  wasmBasePath?: string;

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
export function detectWebGLSupport(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return gl !== null;
  } catch {
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
export class MediaPipeBrowserDetector implements PoseDetector {
  private readonly landmarker: PoseLandmarker;
  private readonly runningMode: "IMAGE" | "VIDEO";
  private closed = false;

  /**
   * Private constructor. Use createMediaPipeBrowserDetector() factory function.
   */
  private constructor(
    landmarker: PoseLandmarker,
    runningMode: "IMAGE" | "VIDEO",
  ) {
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
  static async create(
    config: MediaPipeBrowserConfig = {},
  ): Promise<MediaPipeBrowserDetector> {
    const {
      modelComplexity = 1,
      minDetectionConfidence = 0.5,
      minTrackingConfidence = 0.5,
      minPresenceConfidence = 0.5,
      runningMode = "IMAGE",
      delegate = RuntimeDelegate.GPU,
      webglFallback = WebGLFallbackBehavior.AUTO,
    } = config;

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

    let vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

    try {
      vision = await FilesetResolver.forVisionTasks(
        config.wasmBasePath ?? DEFAULT_WASM_BASE_PATH,
      );
    } catch (error) {
      throw new WasmInitializationError(
        `Failed to initialize MediaPipe WASM runtime: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }

    let landmarker: PoseLandmarker;

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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check for model-not-found indicators in the error message
      if (
        errorMessage.includes("404") ||
        errorMessage.includes("not found") ||
        errorMessage.includes("Failed to load") ||
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("ENOENT") ||
        errorMessage.includes("no such file")
      ) {
        throw new ModelNotFoundError(modelPath);
      }

      // For other errors (invalid config, WASM issues, etc.)
      throw new ModelCreationError(
        `Failed to create pose landmarker: ${errorMessage}`,
        error instanceof Error ? error : undefined,
      );
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
  async detect(frame: VideoFrame): Promise<PoseDetectionResult> {
    if (this.closed) {
      throw new DetectorClosedError();
    }

    let result: PoseLandmarkerResult;

    try {
      if (this.runningMode === "VIDEO") {
        // Use detectForVideo for VIDEO mode which requires timestamp
        // Prefer canvas if available (browser), otherwise create ImageData
        if (frame.canvas) {
          result = this.landmarker.detectForVideo(
            frame.canvas,
            frame.timestamp,
          );
        } else {
          // Fallback to ImageData for non-browser frames
          const imageData = new ImageData(
            new Uint8ClampedArray(frame.data),
            frame.width,
            frame.height,
          );
          result = this.landmarker.detectForVideo(imageData, frame.timestamp);
        }
      } else {
        // Use detect for IMAGE mode - ImageData works here
        const imageData = new ImageData(
          new Uint8ClampedArray(frame.data),
          frame.width,
          frame.height,
        );
        result = this.landmarker.detect(imageData);
      }
    } catch (error) {
      throw new PoseDetectionError(
        `Pose detection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
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
  async detectVideo(
    video: HTMLVideoElement,
    timestamp: number,
  ): Promise<PoseDetectionResult> {
    if (this.closed) {
      throw new DetectorClosedError();
    }

    let result: PoseLandmarkerResult;

    try {
      if (this.runningMode === "VIDEO") {
        // Use detectForVideo for VIDEO mode which requires timestamp
        result = this.landmarker.detectForVideo(video, timestamp);
      } else {
        // Use detect for IMAGE mode
        result = this.landmarker.detect(video);
      }
    } catch (error) {
      throw new PoseDetectionError(
        `Pose detection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
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
  private processLandmarkerResult(
    result: PoseLandmarkerResult,
  ): PoseDetectionResult {
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
    const landmarks: Landmark[] = poseLandmarks.map((lm) => ({
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
    const poseConfidence =
      landmarks.reduce((sum, lm) => sum + lm.visibility, 0) / TOTAL_LANDMARKS;

    const poseLandmarksResult: PoseLandmarks = {
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
  async close(): Promise<void> {
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
export async function createMediaPipeBrowserDetector(
  config: MediaPipeBrowserConfig = {},
): Promise<PoseDetector> {
  return MediaPipeBrowserDetector.create(config);
}
