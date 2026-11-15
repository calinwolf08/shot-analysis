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
export { LANDMARK_INDICES, TOTAL_LANDMARKS } from "./types";
export { validateConfig, safeValidateConfig, createConfig, createDefaultConfig, getHandednessMapping, DEFAULT_CONFIG, analysisConfigSchema, shootingHandSchema, timingUnitSchema, formProfileSchema, metricTargetSchema, metricPrioritySchema, numericRangeSchema, } from "./config";
// Utility exports
export { calculateAngle, calculateDistance, calculateDistance2D, normalizeToBodyScale, calculateRelativePosition, movingAverage, movingAveragePoint3D, smoothLandmarkSequence, } from "./utils";
export { 
// Video element provider (browser - for file uploads)
VideoElementProvider, createVideoElementProvider, VideoLoadError, 
// Media stream provider (browser - for live camera)
MediaStreamProvider, createMediaStreamProvider, MediaStreamEndedError, MediaStreamInactiveError, NoVideoTrackError, 
// Shared errors
InvalidFpsError, } from "./providers";
export { ShotAnalyzer, createShotAnalyzer, ShotAnalyzerNotInitializedError, ShotAnalyzerAlreadyInitializedError, } from "./analyzer";
export { createEmptyMetricValue, createEmptyShotAnalysis, createEmptyVideoMetadata, createEmptyAnalysisResult, isSuccessfulMetricResult, getAverageMetricConfidence, filterMetricsByConfidence, } from "./metrics/types";
// v2 metrics (Sequencing / Structure) — extraction for the validator + app
export { extractShotMetrics, metricsForShot, computeSequencing, computeStructure, } from "./metrics/v2";
export { deriveThresholds, referenceOnFrame } from "./metrics/v2";
export { scoreShot } from "./scoring/v2";
export { DEFAULT_FEEDBACK_MESSAGES, createEmptyComparisonSummary, createEmptyProfileComparison, isNumericTarget, isCategoricalTarget, getFeedbackMessage, } from "./profiles/types";
export { ProfileRegistry, getProfileRegistry } from "./profiles/registry";
export { ProfileComparisonEngine, } from "./profiles/comparison";
// Built-in profiles
export { youthFundamentalsProfile, highSchoolProfile, proFormProfile, builtInProfiles, allBuiltInProfiles, getBuiltInProfile, } from "./profiles";
// Detection types exports
export { ShotPhase as DetectionShotPhase, SHOT_PHASES, TOTAL_SHOT_PHASES, } from "./detection/types";
export { createPoseDetector } from "./pose/factory";
export { detectShots as detectShotsFromPoses, detectOrientation, createPoseShotDetector, } from "./detection/pose-shot-detector";
// Keyframe detection (same algorithm the runtime derives phases from and the
// offline harness scores against labels) — exposed so the validator can show
// the detected keyframes next to the self-labeled data.
export { detectKeyframesFromFrames, phasesFromKeyframes, poseLandmarksToFrames, } from "./detection/keyframe-phases";
// Keyframe diagnostics: install a sink to capture the per-keyframe reasoning
// (method + explanation) the detectors emit, for debugging against labels.
export { setKeyframeDiagnosticsSink, } from "./keyframe-detector";
//# sourceMappingURL=browser-entry.js.map