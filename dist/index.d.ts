/**
 * Basketball Shot Form Analysis Module
 *
 * A TypeScript module that uses MediaPipe pose detection to analyze
 * basketball shooting form from video input.
 */
export type { VideoFrame, FrameMetadata, ShootingHand, TimingUnit, NumericRange, Point2D, Point3D, PoseLandmark, PoseLandmarks, ShotPhase, FrameRange, MetricValue, ComparisonStatus, MetricPriority, LandmarkIndex, } from "./types";
export { LANDMARK_INDICES, TOTAL_LANDMARKS } from "./types";
export type { MetricTarget, FormProfile, AnalysisConfig, ValidatedAnalysisConfig, SafeValidateResult, HandednessMapping, } from "./config";
export { validateConfig, safeValidateConfig, createConfig, createDefaultConfig, getHandednessMapping, DEFAULT_CONFIG, analysisConfigSchema, shootingHandSchema, timingUnitSchema, formProfileSchema, metricTargetSchema, metricPrioritySchema, numericRangeSchema, } from "./config";
export { calculateAngle, calculateDistance, calculateDistance2D, normalizeToBodyScale, calculateRelativePosition, movingAverage, movingAveragePoint3D, smoothLandmarkSequence, } from "./utils";
export type { FrameProvider, MediaStreamProviderOptions, VideoElementProviderOptions, } from "./providers";
export { VideoFileProvider, createVideoFileProvider, VideoFileNotFoundError, VideoFileCorruptedError, UnsupportedVideoFormatError, MediaStreamProvider, createMediaStreamProvider, MediaStreamEndedError, MediaStreamInactiveError, NoVideoTrackError, VideoElementProvider, createVideoElementProvider, VideoLoadError, InvalidFpsError, } from "./providers";
export type { FrameAnalysis, ShotAnalyzerOptions } from "./analyzer";
export { ShotAnalyzer, createShotAnalyzer, ShotAnalyzerNotInitializedError, ShotAnalyzerAlreadyInitializedError, } from "./analyzer";
export type { ShotAnalysis, VideoMetadata, AnalysisResult, MetricCalculator, MetricCalculatorContext, MetricCalculatorResult, } from "./metrics/types";
export { createEmptyMetricValue, createEmptyShotAnalysis, createEmptyVideoMetadata, createEmptyAnalysisResult, isSuccessfulMetricResult, getAverageMetricConfidence, filterMetricsByConfidence, } from "./metrics/types";
export type { MetricFeedback, MetricComparisonResult, ComparisonSummary, ProfileComparison, ProfileValidationResult, } from "./profiles/types";
export { DEFAULT_FEEDBACK_MESSAGES, createEmptyComparisonSummary, createEmptyProfileComparison, isNumericTarget, isCategoricalTarget, getFeedbackMessage, } from "./profiles/types";
export { ProfileRegistry, getProfileRegistry } from "./profiles/registry";
export { ProfileComparisonEngine, type ProfileComparisonEngineOptions, } from "./profiles/comparison";
export { youthFundamentalsProfile, highSchoolProfile, proFormProfile, builtInProfiles, allBuiltInProfiles, getBuiltInProfile, } from "./profiles";
export { ShotPhase as DetectionShotPhase, SHOT_PHASES, TOTAL_SHOT_PHASES, } from "./detection/types";
export type { PhaseRange, ShotBoundary, ShotPhases, Shot, FrameLabel, ShotDetectionResult, } from "./detection/types";
export { ShotDetector, createShotDetector, type ShotDetectorConfig, } from "./detection";
export { detectOrientation } from "./detection/pose-shot-detector";
export type { Landmark as DetectionLandmark, PoseLandmarks as DetectionPoseLandmarks, } from "./pose/types";
export { MetricOrchestrator, createShootingArmCalculators, createGuideArmCalculators, createBallMetricCalculators, createLowerBodyCalculators, createPostureCalculators, createTimingCalculators, } from "./metrics";
export type { Orientation } from "./metrics/types";
export { poseDataSchema, frameSchema } from "./testing/types";
export type { PoseData, Frame as PoseDataFrame } from "./testing/types";
export { createPoseDetector, type PoseDetectorConfig, type PoseDetectorRuntime, } from "./pose/factory";
export { extractShotMetrics, metricsForShot, computeSequencing, computeStructure, } from "./metrics/v2";
export { detectKeyframesFromFrames, poseLandmarksToFrames, } from "./detection/keyframe-phases";
export type { ShotMetricsV2, SequencingMetrics, StructureMetrics, Measurement, ExtractOptions, Thresholds, MetricThreshold, } from "./metrics/v2";
export { deriveThresholds } from "./metrics/v2";
export { scoreShot } from "./scoring/v2";
export type { ShotScore, CategoryScore, MetricScore } from "./scoring/v2";
//# sourceMappingURL=index.d.ts.map