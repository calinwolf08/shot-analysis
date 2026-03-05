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
export type { FrameProvider, MediaStreamProviderOptions } from "./providers";
export { VideoFileProvider, createVideoFileProvider, VideoFileNotFoundError, VideoFileCorruptedError, UnsupportedVideoFormatError, MediaStreamProvider, createMediaStreamProvider, MediaStreamEndedError, MediaStreamInactiveError, NoVideoTrackError, InvalidFpsError, } from "./providers";
//# sourceMappingURL=index.d.ts.map