/**
 * Form profile types, schemas, and utilities.
 *
 * This module provides types and validation for form profiles used to compare
 * extracted metrics against target values. Profiles define ideal form
 * characteristics and acceptable ranges for various metrics.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */

// Type exports
export type {
  MetricFeedback,
  NumericRange,
  MetricTarget,
  FormProfile,
  MetricComparisonResult,
  ComparisonSummary,
  ProfileComparison,
  ProfileValidationResult,
} from "./types";

// Utility function exports
export {
  DEFAULT_FEEDBACK_MESSAGES,
  createEmptyComparisonSummary,
  createEmptyProfileComparison,
  isNumericTarget,
  isCategoricalTarget,
  getFeedbackMessage,
} from "./types";

// Schema exports
export {
  metricPrioritySchema,
  comparisonStatusSchema,
  numericRangeSchema,
  metricFeedbackSchema,
  metricTargetSchema,
  formProfileSchema,
  comparisonSummarySchema,
  metricComparisonResultSchema,
  profileComparisonSchema,
  validateProfile,
  safeValidateProfile,
  validateComparison,
  safeValidateComparison,
  type ValidatedFormProfile,
  type ValidatedProfileComparison,
  type SafeValidateProfileResult,
  type SafeValidateComparisonResult,
} from "./schemas";

// Comparison engine exports
export {
  ProfileComparisonEngine,
  type ProfileComparisonEngineOptions,
} from "./comparison";

// Registry exports
export { ProfileRegistry, getProfileRegistry } from "./registry";

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
import type { FormProfile } from "./types";

export const builtInProfiles: Readonly<Record<string, FormProfile>> = {
  "youth-fundamentals": youthFundamentalsProfile,
  "high-school": highSchoolProfile,
  "pro-form": proFormProfile,
} as const;

/**
 * Array of all built-in profiles for iteration.
 */
export const allBuiltInProfiles: readonly FormProfile[] = [
  youthFundamentalsProfile,
  highSchoolProfile,
  proFormProfile,
] as const;

/**
 * Gets a built-in profile by name.
 *
 * @param name - The profile name (e.g., "youth-fundamentals", "high-school", "pro-form")
 * @returns The profile if found, undefined otherwise
 */
export function getBuiltInProfile(name: string): FormProfile | undefined {
  return builtInProfiles[name];
}
