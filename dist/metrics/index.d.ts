/**
 * Metric extraction module for basketball shot analysis.
 *
 * This module provides types and orchestration for calculating form metrics
 * from detected shots. It uses a strategy pattern for metric calculators,
 * allowing flexible composition of different metrics.
 *
 * @example
 * ```typescript
 * import {
 *   MetricOrchestrator,
 *   type MetricCalculator,
 *   type ShotAnalysis
 * } from './metrics';
 *
 * // Create orchestrator with custom calculators
 * const orchestrator = new MetricOrchestrator([
 *   myElbowAngleCalculator,
 *   myKneeFlexionCalculator,
 * ]);
 *
 * // Analyze a shot
 * const analysis = orchestrator.analyzeShot(
 *   0,
 *   poseLandmarks,
 *   frameRange,
 *   phases,
 *   config
 * );
 * ```
 *
 * @see Feature 5.0 - Metric Extraction
 */
export type { MetricValue, ShotAnalysis, VideoMetadata, AnalysisResult, MetricCalculatorContext, MetricCalculatorResult, MetricCalculator, } from "./types";
export { createEmptyMetricValue, createEmptyShotAnalysis, createEmptyVideoMetadata, createEmptyAnalysisResult, isSuccessfulMetricResult, getAverageMetricConfidence, filterMetricsByConfidence, } from "./types";
export { MetricOrchestrator, type MetricsCalculationResult, } from "./metric-orchestrator";
export { ShootingElbowFlareCalculator, ShootingElbowAngleCalculator, MaxArmExtensionCalculator, WristSnapAngleCalculator, FollowThroughHoldCalculator, createShootingArmCalculators, } from "./shooting-arm";
export { GuideElbowFlareCalculator, GuideHandPositionCalculator, GuideHandReleaseCalculator, createGuideArmCalculators, type GuideHandPositionCategory, } from "./guide-arm";
//# sourceMappingURL=index.d.ts.map