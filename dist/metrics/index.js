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
// Helper functions
export { createEmptyMetricValue, createEmptyShotAnalysis, createEmptyVideoMetadata, createEmptyAnalysisResult, isSuccessfulMetricResult, getAverageMetricConfidence, filterMetricsByConfidence, } from "./types";
// Orchestrator
export { MetricOrchestrator, } from "./metric-orchestrator";
// Shooting Arm Calculators
export { ShootingElbowFlareCalculator, ShootingElbowAngleCalculator, MaxArmExtensionCalculator, WristSnapAngleCalculator, FollowThroughHoldCalculator, createShootingArmCalculators, } from "./shooting-arm";
//# sourceMappingURL=index.js.map