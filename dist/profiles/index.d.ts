/**
 * Form profile types, schemas, and utilities.
 *
 * This module provides types and validation for form profiles used to compare
 * extracted metrics against target values. Profiles define ideal form
 * characteristics and acceptable ranges for various metrics.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */
export type { MetricFeedback, NumericRange, MetricTarget, FormProfile, MetricComparisonResult, ComparisonSummary, ProfileComparison, ProfileValidationResult, } from "./types";
export { DEFAULT_FEEDBACK_MESSAGES, createEmptyComparisonSummary, createEmptyProfileComparison, isNumericTarget, isCategoricalTarget, getFeedbackMessage, } from "./types";
export { metricPrioritySchema, comparisonStatusSchema, numericRangeSchema, metricFeedbackSchema, metricTargetSchema, formProfileSchema, comparisonSummarySchema, metricComparisonResultSchema, profileComparisonSchema, validateProfile, safeValidateProfile, validateComparison, safeValidateComparison, type ValidatedFormProfile, type ValidatedProfileComparison, type SafeValidateProfileResult, type SafeValidateComparisonResult, } from "./schemas";
export { youthFundamentalsProfile } from "./youth";
export { highSchoolProfile } from "./high-school";
export { proFormProfile } from "./pro";
import type { FormProfile } from "./types";
export declare const builtInProfiles: Readonly<Record<string, FormProfile>>;
/**
 * Array of all built-in profiles for iteration.
 */
export declare const allBuiltInProfiles: readonly FormProfile[];
/**
 * Gets a built-in profile by name.
 *
 * @param name - The profile name (e.g., "youth-fundamentals", "high-school", "pro-form")
 * @returns The profile if found, undefined otherwise
 */
export declare function getBuiltInProfile(name: string): FormProfile | undefined;
//# sourceMappingURL=index.d.ts.map