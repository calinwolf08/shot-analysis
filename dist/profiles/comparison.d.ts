/**
 * Profile comparison engine for comparing shot metrics against form profiles.
 *
 * This module implements the comparison logic for evaluating shot analysis results
 * against target profiles. It handles both numeric and categorical metrics,
 * determines pass/fail/warning status, and generates prioritized feedback.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */
import type { ShotAnalysis } from "../metrics/types";
import { type FormProfile, type ProfileComparison } from "./types";
/**
 * Configuration options for the ProfileComparisonEngine.
 */
export interface ProfileComparisonEngineOptions {
    /**
     * Percentage of acceptable range that defines the "warning zone" near boundaries.
     * Values within the warning zone will get a "warning" status instead of "pass".
     * Default: 0.2 (20% of range from each boundary)
     */
    readonly warningThreshold?: number;
    /**
     * Confidence threshold below which metrics are marked as warning regardless of value.
     * Default: 0.5
     */
    readonly lowConfidenceThreshold?: number;
}
/**
 * Engine for comparing shot analysis metrics against form profiles.
 *
 * The engine evaluates each metric in the shot analysis against corresponding
 * targets in the profile, determining status and generating feedback.
 *
 * @example
 * ```typescript
 * const engine = new ProfileComparisonEngine();
 * const result = engine.compareToProfile(shotAnalysis, youthProfile);
 * console.log(result.summary.priorityIssues);
 * ```
 */
export declare class ProfileComparisonEngine {
    private readonly options;
    /**
     * Creates a new ProfileComparisonEngine with the specified options.
     *
     * @param options - Configuration options for the engine
     */
    constructor(options?: ProfileComparisonEngineOptions);
    /**
     * Compares a shot analysis against a form profile.
     *
     * Only metrics present in both the shot and the profile are compared.
     * Metrics in the shot but not in the profile are ignored.
     * Profile targets without corresponding shot metrics are skipped.
     *
     * @param shot - The shot analysis containing measured metrics
     * @param profile - The form profile with target specifications
     * @returns Complete comparison result with per-metric results and summary
     */
    compareToProfile(shot: ShotAnalysis, profile: FormProfile): ProfileComparison;
    /**
     * Compares a single metric value against its target.
     *
     * @param metricValue - The measured metric value
     * @param target - The target specification to compare against
     * @returns Comparison result with status, deviation, and feedback
     */
    private compareMetric;
    /**
     * Compares a numeric metric value against its numeric range target.
     */
    private compareNumericMetric;
    /**
     * Compares a categorical metric value against its list of acceptable values.
     */
    private compareCategoricalMetric;
    /**
     * Generates the comparison summary from the metric results.
     */
    private generateSummary;
}
//# sourceMappingURL=comparison.d.ts.map