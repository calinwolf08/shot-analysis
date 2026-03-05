/**
 * Basketball Shot Form Analysis Module
 *
 * A TypeScript module that uses MediaPipe pose detection to analyze
 * basketball shooting form from video input.
 */

// Type exports
export type {
  VideoFrame,
  FrameMetadata,
  ShootingHand,
  TimingUnit,
  NumericRange,
  Point2D,
  Point3D,
  PoseLandmark,
  PoseLandmarks,
  ShotPhase,
  FrameRange,
  MetricValue,
  ComparisonStatus,
  MetricPriority,
  LandmarkIndex,
} from "./types";

export { LANDMARK_INDICES, TOTAL_LANDMARKS } from "./types";

// Configuration exports
export type {
  MetricTarget,
  FormProfile,
  AnalysisConfig,
  ValidatedAnalysisConfig,
  SafeValidateResult,
  HandednessMapping,
} from "./config";

export {
  validateConfig,
  safeValidateConfig,
  createConfig,
  createDefaultConfig,
  getHandednessMapping,
  DEFAULT_CONFIG,
  analysisConfigSchema,
  shootingHandSchema,
  timingUnitSchema,
  formProfileSchema,
  metricTargetSchema,
  metricPrioritySchema,
  numericRangeSchema,
} from "./config";

// Utility exports
export {
  // Geometry utilities
  calculateAngle,
  calculateDistance,
  calculateDistance2D,
  // Coordinate normalization utilities
  normalizeToBodyScale,
  calculateRelativePosition,
  // Smoothing utilities
  movingAverage,
  movingAveragePoint3D,
  smoothLandmarkSequence,
} from "./utils";

// Frame provider exports
export type { FrameProvider, MediaStreamProviderOptions } from "./providers";
export {
  // Video file provider (Node.js)
  VideoFileProvider,
  createVideoFileProvider,
  VideoFileNotFoundError,
  VideoFileCorruptedError,
  UnsupportedVideoFormatError,
  // Media stream provider (browser)
  MediaStreamProvider,
  createMediaStreamProvider,
  MediaStreamEndedError,
  MediaStreamInactiveError,
  NoVideoTrackError,
  // Shared errors
  InvalidFpsError,
} from "./providers";
