/**
 * Type definitions for form profiles and profile comparisons.
 *
 * This module defines types for comparing extracted metrics against target profiles
 * to identify form issues. It builds on the core FormProfile and MetricTarget types
 * from config.ts and adds comparison result types.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */
/**
 * Default feedback messages used when profile doesn't specify custom messages.
 */
export const DEFAULT_FEEDBACK_MESSAGES = {
    tooLow: "Value is below the acceptable range",
    tooHigh: "Value is above the acceptable range",
    incorrect: "Value is not within acceptable options",
};
/**
 * Creates an empty comparison summary with all counts at zero.
 */
export function createEmptyComparisonSummary() {
    return {
        passCount: 0,
        failCount: 0,
        warningCount: 0,
        priorityIssues: [],
    };
}
/**
 * Creates an empty profile comparison result.
 *
 * @param profileName - Name of the profile
 */
export function createEmptyProfileComparison(profileName) {
    return {
        profile: profileName,
        metrics: {},
        summary: createEmptyComparisonSummary(),
    };
}
/**
 * Checks if a target uses numeric acceptable values (range).
 *
 * @param target - The metric target to check
 * @returns true if the target uses numeric range
 */
export function isNumericTarget(target) {
    return (typeof target.acceptable === "object" &&
        !Array.isArray(target.acceptable) &&
        "min" in target.acceptable &&
        "max" in target.acceptable);
}
/**
 * Checks if a target uses categorical acceptable values (string array).
 *
 * @param target - The metric target to check
 * @returns true if the target uses categorical values
 */
export function isCategoricalTarget(target) {
    return Array.isArray(target.acceptable);
}
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
export function getFeedbackMessage(target, status, isNumeric, isTooLow) {
    if (status === "pass") {
        return undefined;
    }
    if (isNumeric) {
        if (isTooLow) {
            return target.feedback.tooLow ?? DEFAULT_FEEDBACK_MESSAGES.tooLow;
        }
        else {
            return target.feedback.tooHigh ?? DEFAULT_FEEDBACK_MESSAGES.tooHigh;
        }
    }
    else {
        return target.feedback.incorrect ?? DEFAULT_FEEDBACK_MESSAGES.incorrect;
    }
}
//# sourceMappingURL=types.js.map