/**
 * Pose detection module for basketball shot analysis.
 *
 * This module provides types and utilities for working with MediaPipe
 * pose detection results.
 */

// Type exports
export type {
  Landmark,
  PoseLandmarks,
  PoseDetectionResult,
  LandmarkIndexValue,
  LandmarkName,
} from "./types";

// Constant exports
export { LANDMARK_INDEX, TOTAL_LANDMARKS } from "./types";

// Helper function exports
export {
  getLandmarkByIndex,
  getLandmarkByName,
  createEmptyLandmark,
  createEmptyPoseLandmarks,
  isLandmarkOccluded,
} from "./types";

// PoseDetector interface and errors
export type { PoseDetector } from "./detector";
export { PoseDetectionError, DetectorClosedError } from "./detector";

// MediaPipe Node.js implementation
export type { MediaPipeNodeConfig } from "./mediapipe-node";
export {
  MediaPipeNodeDetector,
  ModelNotFoundError,
  WasmInitializationError,
  ModelCreationError,
  createMediaPipeNodeDetector,
  DEFAULT_MODEL_PATH,
  MODEL_PATHS,
} from "./mediapipe-node";
