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
export type {
  FrameProvider,
  MediaStreamProviderOptions,
  VideoElementProviderOptions,
} from "./providers";
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
  // Video element provider (browser - for file uploads)
  VideoElementProvider,
  createVideoElementProvider,
  VideoLoadError,
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

// Detection pipeline exports (public API for consumers that drive the
// pipeline directly, e.g. replaying recorded pose sequences)
export {
  ShotDetector,
  createShotDetector,
  type ShotDetectorConfig,
} from "./detection";
export { detectOrientation } from "./detection/pose-shot-detector";

// Pose-format types used by the detection pipeline (distinct from the
// metrics-format PoseLandmarks exported above)
export type {
  Landmark as DetectionLandmark,
  PoseLandmarks as DetectionPoseLandmarks,
} from "./pose/types";

// Metrics pipeline exports
export {
  MetricOrchestrator,
  createShootingArmCalculators,
  createGuideArmCalculators,
  createBallMetricCalculators,
  createLowerBodyCalculators,
  createPostureCalculators,
  createTimingCalculators,
} from "./metrics";
export type { Orientation } from "./metrics/types";

// Recorded pose-sequence (fixture) types + schema, for replay consumers
export { poseDataSchema, frameSchema } from "./testing/types";
export type { PoseData, Frame as PoseDataFrame } from "./testing/types";

// Pose detector factory (used by the app's analysis worker with
// locally-hosted assets)
export {
  createPoseDetector,
  type PoseDetectorConfig,
  type PoseDetectorRuntime,
} from "./pose/factory";

// v2 metrics (Sequencing / Structure overhaul) — extraction + measurement types
export {
  extractShotMetrics,
  metricsForShot,
  computeSequencing,
  computeStructure,
} from "./metrics/v2";
export type {
  ShotMetricsV2,
  SequencingMetrics,
  StructureMetrics,
  Measurement,
  ExtractOptions,
} from "./metrics/v2";
