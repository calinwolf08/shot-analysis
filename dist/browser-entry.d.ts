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
export type { VideoFrame, FrameMetadata, ShootingHand, TimingUnit, NumericRange, Point2D, Point3D, PoseLandmark, PoseLandmarks, ShotPhase, FrameRange, MetricValue, ComparisonStatus, MetricPriority, LandmarkIndex, } from "./types";
export { LANDMARK_INDICES, TOTAL_LANDMARKS } from "./types";
export type { MetricTarget, FormProfile, AnalysisConfig, ValidatedAnalysisConfig, SafeValidateResult, HandednessMapping, } from "./config";
export { validateConfig, safeValidateConfig, createConfig, createDefaultConfig, getHandednessMapping, DEFAULT_CONFIG, analysisConfigSchema, shootingHandSchema, timingUnitSchema, formProfileSchema, metricTargetSchema, metricPrioritySchema, numericRangeSchema, } from "./config";
export { calculateAngle, calculateDistance, calculateDistance2D, normalizeToBodyScale, calculateRelativePosition, movingAverage, movingAveragePoint3D, smoothLandmarkSequence, } from "./utils";
export type { FrameProvider, MediaStreamProviderOptions, VideoElementProviderOptions, } from "./providers";
export { VideoElementProvider, createVideoElementProvider, VideoLoadError, MediaStreamProvider, createMediaStreamProvider, MediaStreamEndedError, MediaStreamInactiveError, NoVideoTrackError, InvalidFpsError, } from "./providers";
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
export type { PoseDetector } from "./pose/detector";
export type { PoseDetectorConfig } from "./pose/factory";
export { createPoseDetector } from "./pose/factory";
export type { PoseData, Frame as PoseFrame, TestLandmark, Orientation, } from "./testing/types";
export type { PoseShotDetectorConfig, DetectedShot as PoseDetectedShot, DetectionResult as PoseDetectionResult, } from "./detection/pose-shot-detector";
export { detectShots as detectShotsFromPoses, detectOrientation, createPoseShotDetector, } from "./detection/pose-shot-detector";
export { detectKeyframesFromFrames, phasesFromKeyframes, poseLandmarksToFrames, } from "./detection/keyframe-phases";
export type { KeyframeId } from "./testing/types";
export { setKeyframeDiagnosticsSink, type KeyframeDiagnostic, } from "./keyframe-detector";
//# sourceMappingURL=browser-entry.d.ts.map