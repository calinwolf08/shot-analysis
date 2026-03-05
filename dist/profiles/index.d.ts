/**
 * Form profile types, schemas, and utilities.
 *
 * This module provides types and validation for form profiles used to compare
 * extracted metrics against target values. Profiles define ideal form
 * characteristics and acceptable ranges for various metrics.
 *
 * ## Feature 6.0 - Form Profile Comparison
 *
 * ### Built-in Profiles
 * - **youth-fundamentals**: Ages 8-12, wider acceptable ranges, simplified feedback
 * - **high-school**: Ages 13-18, refined mechanics with timing emphasis
 * - **pro-form**: Elite/professional, tight tolerances on all metrics
 *
 * ### Known Limitations
 * 1. Profile metric values are based on general biomechanics research and may need
 *    adjustment based on individual player characteristics (height, arm length, etc.)
 * 2. Categorical metrics (e.g., handCupVsHinge) rely on pose detection accuracy
 *    which may vary based on camera angle and lighting conditions
 * 3. The warning threshold for boundary values is configurable but applies uniformly
 *    to all metrics - per-metric warning zones are not currently supported
 * 4. Profile inheritance/composition is not supported - custom profiles must define
 *    all targets explicitly
 *
 * ### Future Improvements
 * 1. Add profile interpolation to blend between skill levels
 * 2. Support metric weighting in overall score calculation
 * 3. Add historical comparison to track improvement over time
 * 4. Add position-specific profiles (e.g., guard vs post player shooting)
 * 5. Add adaptive profiles that adjust based on player's consistent deviations
 *
 * @see Feature 6.0 - Form Profile Comparison
 */
export type { MetricFeedback, NumericRange, MetricTarget, FormProfile, MetricComparisonResult, ComparisonSummary, ProfileComparison, ProfileValidationResult, } from "./types";
export { DEFAULT_FEEDBACK_MESSAGES, createEmptyComparisonSummary, createEmptyProfileComparison, isNumericTarget, isCategoricalTarget, getFeedbackMessage, } from "./types";
export { metricPrioritySchema, comparisonStatusSchema, numericRangeSchema, metricFeedbackSchema, metricTargetSchema, formProfileSchema, comparisonSummarySchema, metricComparisonResultSchema, profileComparisonSchema, validateProfile, safeValidateProfile, validateComparison, safeValidateComparison, type ValidatedFormProfile, type ValidatedProfileComparison, type SafeValidateProfileResult, type SafeValidateComparisonResult, } from "./schemas";
export { ProfileComparisonEngine, type ProfileComparisonEngineOptions, } from "./comparison";
export { ProfileRegistry, getProfileRegistry } from "./registry";
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