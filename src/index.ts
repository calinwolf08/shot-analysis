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

// Analyzer exports
export type { FrameAnalysis, ShotAnalyzerOptions } from "./analyzer";
export {
  ShotAnalyzer,
  createShotAnalyzer,
  ShotAnalyzerNotInitializedError,
  ShotAnalyzerAlreadyInitializedError,
} from "./analyzer";

// Metrics types exports
export type {
  ShotAnalysis,
  VideoMetadata,
  AnalysisResult,
  MetricCalculator,
  MetricCalculatorContext,
  MetricCalculatorResult,
} from "./metrics/types";

export {
  createEmptyMetricValue,
  createEmptyShotAnalysis,
  createEmptyVideoMetadata,
  createEmptyAnalysisResult,
  isSuccessfulMetricResult,
  getAverageMetricConfidence,
  filterMetricsByConfidence,
} from "./metrics/types";

// Profile exports
export type {
  MetricFeedback,
  MetricComparisonResult,
  ComparisonSummary,
  ProfileComparison,
  ProfileValidationResult,
} from "./profiles/types";

export {
  DEFAULT_FEEDBACK_MESSAGES,
  createEmptyComparisonSummary,
  createEmptyProfileComparison,
  isNumericTarget,
  isCategoricalTarget,
  getFeedbackMessage,
} from "./profiles/types";

export { ProfileRegistry, getProfileRegistry } from "./profiles/registry";

export {
  ProfileComparisonEngine,
  type ProfileComparisonEngineOptions,
} from "./profiles/comparison";

// Built-in profiles
export {
  youthFundamentalsProfile,
  highSchoolProfile,
  proFormProfile,
  builtInProfiles,
  allBuiltInProfiles,
  getBuiltInProfile,
} from "./profiles";

// Detection types exports
export {
  ShotPhase as DetectionShotPhase,
  SHOT_PHASES,
  TOTAL_SHOT_PHASES,
} from "./detection/types";

export type {
  PhaseRange,
  ShotBoundary,
  ShotPhases,
  Shot,
  FrameLabel,
  ShotDetectionResult,
} from "./detection/types";
