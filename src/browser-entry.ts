/**
 * Browser entry point for the basketball shot analysis library.
 *
 * This module exports only the browser-compatible parts of the library,
 * excluding Node.js-specific functionality like VideoFileProvider.
 *
 * Usage in browser:
 * ```html
 * <script src="dist/shot-analysis.browser.js"></script>
 * <script>
 *   const { createShotAnalyzer, createConfig, createVideoElementProvider } = ShotAnalysis;
 *
 *   // Create analyzer
 *   const analyzer = await createShotAnalyzer(createConfig({ shootingHand: 'right' }));
 *
 *   // Load video from file input
 *   const fileInput = document.getElementById('videoFile');
 *   const provider = await createVideoElementProvider(fileInput.files[0]);
 *
 *   // Run analysis
 *   const result = await analyzer.analyzeVideo(provider);
 *   console.log('Detected shots:', result.shots.length);
 * </script>
 * ```
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
  calculateAngle,
  calculateDistance,
  calculateDistance2D,
  normalizeToBodyScale,
  calculateRelativePosition,
  movingAverage,
  movingAveragePoint3D,
  smoothLandmarkSequence,
} from "./utils";

// Frame provider exports (browser-only)
export type {
  FrameProvider,
  MediaStreamProviderOptions,
  VideoElementProviderOptions,
} from "./providers";

export {
  // Video element provider (browser - for file uploads)
  VideoElementProvider,
  createVideoElementProvider,
  VideoLoadError,
  // Media stream provider (browser - for live camera)
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

// Pose detector exports (browser-compatible factory)
export type { PoseDetector } from "./pose/detector";
export type { PoseDetectorConfig } from "./pose/factory";
export { createPoseDetector } from "./pose/factory";

// Pose-based shot detection exports
export type {
  PoseData,
  Frame as PoseFrame,
  TestLandmark,
  Orientation,
} from "./testing/types";

export type {
  PoseShotDetectorConfig,
  DetectedShot as PoseDetectedShot,
  DetectionResult as PoseDetectionResult,
} from "./detection/pose-shot-detector";

export {
  detectShots as detectShotsFromPoses,
  detectOrientation,
  createPoseShotDetector,
} from "./detection/pose-shot-detector";
