/**
 * Form profile types, schemas, and utilities.
 *
 * This module provides types and validation for form profiles used to compare
 * extracted metrics against target values. Profiles define ideal form
 * characteristics and acceptable ranges for various metrics.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */
// Utility function exports
export { DEFAULT_FEEDBACK_MESSAGES, createEmptyComparisonSummary, createEmptyProfileComparison, isNumericTarget, isCategoricalTarget, getFeedbackMessage, } from "./types";
// Schema exports
export { metricPrioritySchema, comparisonStatusSchema, numericRangeSchema, metricFeedbackSchema, metricTargetSchema, formProfileSchema, comparisonSummarySchema, metricComparisonResultSchema, profileComparisonSchema, validateProfile, safeValidateProfile, validateComparison, safeValidateComparison, } from "./schemas";
// Built-in profile exports
export { youthFundamentalsProfile } from "./youth";
export { highSchoolProfile } from "./high-school";
export { proFormProfile } from "./pro";
/**
 * All built-in profiles as a record keyed by profile name.
 * Convenient for looking up profiles by name.
 */
import { youthFundamentalsProfile } from "./youth";
import { highSchoolProfile } from "./high-school";
import { proFormProfile } from "./pro";
export const builtInProfiles = {
    "youth-fundamentals": youthFundamentalsProfile,
    "high-school": highSchoolProfile,
    "pro-form": proFormProfile,
};
/**
 * Array of all built-in profiles for iteration.
 */
export const allBuiltInProfiles = [
    youthFundamentalsProfile,
    highSchoolProfile,
    proFormProfile,
];
/**
 * Gets a built-in profile by name.
 *
 * @param name - The profile name (e.g., "youth-fundamentals", "high-school", "pro-form")
 * @returns The profile if found, undefined otherwise
 */
export function getBuiltInProfile(name) {
    return builtInProfiles[name];
}
//# sourceMappingURL=index.js.map