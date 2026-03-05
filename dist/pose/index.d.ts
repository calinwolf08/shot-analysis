/**
 * Pose detection module for basketball shot analysis.
 *
 * This module provides types and utilities for working with MediaPipe
 * pose detection results.
 */
export type { Landmark, PoseLandmarks, PoseDetectionResult, LandmarkIndexValue, LandmarkName, } from "./types";
export { LANDMARK_INDEX, TOTAL_LANDMARKS } from "./types";
export { getLandmarkByIndex, getLandmarkByName, createEmptyLandmark, createEmptyPoseLandmarks, isLandmarkOccluded, } from "./types";
export type { PoseDetector } from "./detector";
export { PoseDetectionError, DetectorClosedError } from "./detector";
export type { MediaPipeNodeConfig } from "./mediapipe-node";
export { MediaPipeNodeDetector, ModelNotFoundError, WasmInitializationError, ModelCreationError, createMediaPipeNodeDetector, DEFAULT_MODEL_PATH, MODEL_PATHS, } from "./mediapipe-node";
//# sourceMappingURL=index.d.ts.map