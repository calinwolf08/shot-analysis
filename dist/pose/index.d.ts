/**
 * Pose detection module for basketball shot analysis.
 *
 * This module provides types and utilities for working with MediaPipe
 * pose detection results. It includes implementations for both Node.js
 * and browser environments with automatic runtime detection.
 *
 * ## Usage
 *
 * ```typescript
 * import { createPoseDetector } from './pose';
 *
 * // Auto-detect runtime and create detector
 * const detector = await createPoseDetector();
 *
 * // Detect pose in a video frame
 * const result = await detector.detect(frame);
 * if (result) {
 *   const leftShoulder = result.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
 *   console.log(`Left shoulder at (${leftShoulder.x}, ${leftShoulder.y})`);
 * }
 *
 * // Clean up
 * await detector.close();
 * ```
 *
 * ## Known Limitations
 *
 * - Node.js integration tests require `navigator` global (skipped in headless environments)
 * - Browser GPU delegate requires WebGL 2.0 support
 * - Single-person detection only; multi-person requires custom batching
 * - Model download requires network access on first initialization
 * - Heavy model (complexity 2) may cause performance issues on mobile devices
 *
 * ## Future Improvements
 *
 * - Add multi-person pose detection support
 * - Implement pose landmark smoothing/filtering for video sequences
 * - Add support for custom model paths and local model files
 * - WebGPU delegate support for improved browser performance
 * - Add pose skeleton visualization utilities
 */
export type { Landmark, PoseLandmarks, PoseDetectionResult, LandmarkIndexValue, LandmarkName, } from "./types";
export { LANDMARK_INDEX, TOTAL_LANDMARKS } from "./types";
export { getLandmarkByIndex, getLandmarkByName, createEmptyLandmark, createEmptyPoseLandmarks, isLandmarkOccluded, } from "./types";
export type { PoseDetector } from "./detector";
export { PoseDetectionError, DetectorClosedError } from "./detector";
export type { MediaPipeNodeConfig } from "./mediapipe-node";
export { MediaPipeNodeDetector, ModelNotFoundError, WasmInitializationError, ModelCreationError, createMediaPipeNodeDetector, DEFAULT_MODEL_PATH, MODEL_PATHS, } from "./mediapipe-node";
export type { MediaPipeBrowserConfig } from "./mediapipe-browser";
export { MediaPipeBrowserDetector, WebGLNotAvailableError, WebGLFallbackBehavior, RuntimeDelegate, createMediaPipeBrowserDetector, detectWebGLSupport, } from "./mediapipe-browser";
export type { PoseDetectorRuntime, PoseDetectorConfig } from "./factory";
export { createPoseDetector, detectRuntime, UnknownRuntimeError, } from "./factory";
//# sourceMappingURL=index.d.ts.map