/**
 * Basketball Shot Form Analysis Module
 *
 * A TypeScript module that uses MediaPipe pose detection to analyze
 * basketball shooting form from video input.
 */
export { LANDMARK_INDICES, TOTAL_LANDMARKS } from "./types";
export { validateConfig, safeValidateConfig, createConfig, createDefaultConfig, getHandednessMapping, DEFAULT_CONFIG, analysisConfigSchema, shootingHandSchema, timingUnitSchema, formProfileSchema, metricTargetSchema, metricPrioritySchema, numericRangeSchema, } from "./config";
// Utility exports
export { 
// Geometry utilities
calculateAngle, calculateDistance, calculateDistance2D, 
// Coordinate normalization utilities
normalizeToBodyScale, calculateRelativePosition, 
// Smoothing utilities
movingAverage, movingAveragePoint3D, smoothLandmarkSequence, } from "./utils";
export { 
// Video file provider (Node.js)
VideoFileProvider, createVideoFileProvider, VideoFileNotFoundError, VideoFileCorruptedError, UnsupportedVideoFormatError, 
// Media stream provider (browser)
MediaStreamProvider, createMediaStreamProvider, MediaStreamEndedError, MediaStreamInactiveError, NoVideoTrackError, 
// Video element provider (browser - for file uploads)
VideoElementProvider, createVideoElementProvider, VideoLoadError, 
// Shared errors
InvalidFpsError, } from "./providers";
export { ShotAnalyzer, createShotAnalyzer, ShotAnalyzerNotInitializedError, ShotAnalyzerAlreadyInitializedError, } from "./analyzer";
export { createEmptyMetricValue, createEmptyShotAnalysis, createEmptyVideoMetadata, createEmptyAnalysisResult, isSuccessfulMetricResult, getAverageMetricConfidence, filterMetricsByConfidence, } from "./metrics/types";
export { DEFAULT_FEEDBACK_MESSAGES, createEmptyComparisonSummary, createEmptyProfileComparison, isNumericTarget, isCategoricalTarget, getFeedbackMessage, } from "./profiles/types";
export { ProfileRegistry, getProfileRegistry } from "./profiles/registry";
export { ProfileComparisonEngine, } from "./profiles/comparison";
// Built-in profiles
export { youthFundamentalsProfile, highSchoolProfile, proFormProfile, builtInProfiles, allBuiltInProfiles, getBuiltInProfile, } from "./profiles";
// Detection types exports
export { ShotPhase as DetectionShotPhase, SHOT_PHASES, TOTAL_SHOT_PHASES, } from "./detection/types";
// Detection pipeline exports (public API for consumers that drive the
// pipeline directly, e.g. replaying recorded pose sequences)
export { ShotDetector, createShotDetector, } from "./detection";
export { detectOrientation } from "./detection/pose-shot-detector";
// Metrics pipeline exports
export { MetricOrchestrator, createShootingArmCalculators, createGuideArmCalculators, createBallMetricCalculators, createLowerBodyCalculators, createPostureCalculators, createTimingCalculators, } from "./metrics";
// Recorded pose-sequence (fixture) types + schema, for replay consumers
export { poseDataSchema, frameSchema } from "./testing/types";
//# sourceMappingURL=index.js.map