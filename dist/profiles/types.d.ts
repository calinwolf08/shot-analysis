/**
 * Type definitions for form profiles and profile comparisons.
 *
 * This module defines types for comparing extracted metrics against target profiles
 * to identify form issues. It builds on the core FormProfile and MetricTarget types
 * from config.ts and adds comparison result types.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */
import type { ComparisonStatus, MetricPriority } from "../types";
/**
 * Feedback messages for metric deviations.
 * These messages are shown to users when metrics fall outside acceptable ranges.
 */
export interface MetricFeedback {
    /** Feedback when numeric value is below acceptable minimum */
    readonly tooLow?: string;
    /** Feedback when numeric value is above acceptable maximum */
    readonly tooHigh?: string;
    /** Feedback when categorical value is not in acceptable values */
    readonly incorrect?: string;
}
/**
 * Numeric range for acceptable metric values.
 */
export interface NumericRange {
    readonly min: number;
    readonly max: number;
}
/**
 * Target specification for a single metric in a form profile.
 *
 * Supports both numeric metrics (with range-based acceptable values)
 * and categorical metrics (with list-based acceptable values).
 */
export interface MetricTarget {
    /** Ideal value for this metric (numeric for measurements, string for categorical) */
    readonly ideal: number | string;
    /** Acceptable range (for numeric) or values (for categorical) */
    readonly acceptable: NumericRange | readonly string[];
    /** Priority level for feedback (high issues are shown first) */
    readonly priority: MetricPriority;
    /** Feedback messages for deviations */
    readonly feedback: MetricFeedback;
}
/**
 * A form profile defining target metrics for shot analysis comparison.
 *
 * Profiles define the ideal form characteristics and acceptable ranges
 * for various metrics. Different profiles can target different skill levels
 * (e.g., youth-fundamentals vs pro-form).
 */
export interface FormProfile {
    /** Profile name (must be non-empty, used as identifier) */
    readonly name: string;
    /** Human-readable profile description */
    readonly description: string;
    /** Target values for each metric, keyed by metric name */
    readonly targets: Readonly<Record<string, MetricTarget>>;
}
/**
 * Comparison result for a single metric against its target.
 */
export interface MetricComparisonResult {
    /** The measured value from shot analysis */
    readonly value: number | string;
    /** The target specification this metric was compared against */
    readonly target: MetricTarget;
    /** Comparison status: pass, fail, or warning */
    readonly status: ComparisonStatus;
    /** Numeric deviation from ideal (undefined for categorical metrics or when status is 'pass') */
    readonly deviation?: number;
    /** Feedback message for the user (undefined when status is 'pass') */
    readonly feedback?: string;
}
/**
 * Summary statistics for a profile comparison.
 */
export interface ComparisonSummary {
    /** Number of metrics that passed (within acceptable range) */
    readonly passCount: number;
    /** Number of metrics that failed (outside acceptable range) */
    readonly failCount: number;
    /** Number of metrics with warnings (marginal values) */
    readonly warningCount: number;
    /** List of high-priority issues that need attention (metric names with feedback) */
    readonly priorityIssues: readonly string[];
}
/**
 * Complete comparison result of shot metrics against a form profile.
 *
 * Contains per-metric comparison results and summary statistics.
 */
export interface ProfileComparison {
    /** Name of the profile used for comparison */
    readonly profile: string;
    /** Comparison results for each metric that was compared */
    readonly metrics: Readonly<Record<string, MetricComparisonResult>>;
    /** Summary statistics for the comparison */
    readonly summary: ComparisonSummary;
}
/**
 * Result of validating a profile, including any warnings.
 */
export interface ProfileValidationResult {
    /** Whether the profile is valid */
    readonly valid: boolean;
    /** Validation error messages (empty if valid) */
    readonly errors: readonly string[];
    /** Warning messages for non-critical issues (e.g., unknown metric names) */
    readonly warnings: readonly string[];
}
/**
 * Default feedback messages used when profile doesn't specify custom messages.
 */
export declare const DEFAULT_FEEDBACK_MESSAGES: {
    readonly tooLow: "Value is below the acceptable range";
    readonly tooHigh: "Value is above the acceptable range";
    readonly incorrect: "Value is not within acceptable options";
};
/**
 * Creates an empty comparison summary with all counts at zero.
 */
export declare function createEmptyComparisonSummary(): ComparisonSummary;
/**
 * Creates an empty profile comparison result.
 *
 * @param profileName - Name of the profile
 */
export declare function createEmptyProfileComparison(profileName: string): ProfileComparison;
/**
 * Checks if a target uses numeric acceptable values (range).
 *
 * @param target - The metric target to check
 * @returns true if the target uses numeric range
 */
export declare function isNumericTarget(target: MetricTarget): target is MetricTarget & {
    readonly acceptable: NumericRange;
};
/**
 * Checks if a target uses categorical acceptable values (string array).
 *
 * @param target - The metric target to check
 * @returns true if the target uses categorical values
 */
export declare function isCategoricalTarget(target: MetricTarget): target is MetricTarget & {
    readonly acceptable: readonly string[];
};
/**
 * Gets the appropriate feedback message for a metric comparison result.
 * Uses default messages if the target doesn't specify custom feedback.
 *
 * @param target - The metric target with feedback configuration
 * @param status - The comparison status
 * @param isNumeric - Whether this is a numeric metric
 * @param isTooLow - For numeric metrics, whether the value is too low (vs too high)
 * @returns The feedback message or undefined if status is 'pass'
 */
export declare function getFeedbackMessage(target: MetricTarget, status: ComparisonStatus, isNumeric: boolean, isTooLow?: boolean): string | undefined;
//# sourceMappingURL=types.d.ts.map