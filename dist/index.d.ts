/**
 * Basketball Shot Form Analysis Module
 *
 * A TypeScript module that uses MediaPipe pose detection to analyze
 * basketball shooting form from video input.
 */
export type { VideoFrame, FrameMetadata, ShootingHand, TimingUnit, NumericRange, Point2D, Point3D, PoseLandmark, PoseLandmarks, ShotPhase, FrameRange, MetricValue, ComparisonStatus, MetricPriority, LandmarkIndex } from './types';
export { LANDMARK_INDICES, TOTAL_LANDMARKS } from './types';
export type { MetricTarget, FormProfile, AnalysisConfig, ValidatedAnalysisConfig, SafeValidateResult, HandednessMapping } from './config';
export { validateConfig, safeValidateConfig, createConfig, createDefaultConfig, getHandednessMapping, DEFAULT_CONFIG, analysisConfigSchema, shootingHandSchema, timingUnitSchema, formProfileSchema, metricTargetSchema, metricPrioritySchema, numericRangeSchema } from './config';
//# sourceMappingURL=index.d.ts.map