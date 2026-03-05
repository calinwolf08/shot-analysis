/**
 * Zod schemas for profile validation.
 *
 * This module provides runtime validation for form profiles and comparison results.
 * All schemas are designed to match the type definitions in types.ts.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */

import { z } from "zod";

/**
 * Zod schema for MetricPriority.
 */
export const metricPrioritySchema = z.enum(["high", "medium", "low"]);

/**
 * Zod schema for ComparisonStatus.
 */
export const comparisonStatusSchema = z.enum(["pass", "fail", "warning"]);

/**
 * Zod schema for numeric range validation.
 * Ensures min is less than or equal to max.
 */
export const numericRangeSchema = z
  .object({
    min: z.number(),
    max: z.number(),
  })
  .refine((data) => data.min <= data.max, {
    message: "min must be less than or equal to max",
  });

/**
 * Zod schema for feedback messages.
 * All fields are optional as defaults can be used.
 */
export const metricFeedbackSchema = z.object({
  tooLow: z.string().optional(),
  tooHigh: z.string().optional(),
  incorrect: z.string().optional(),
});

/**
 * Zod schema for metric target validation.
 * Supports both numeric (range) and categorical (string array) acceptable values.
 */
export const metricTargetSchema = z.object({
  ideal: z.union([z.number(), z.string()]),
  acceptable: z.union([numericRangeSchema, z.array(z.string()).readonly()]),
  priority: metricPrioritySchema,
  feedback: metricFeedbackSchema,
});

/**
 * Zod schema for FormProfile validation.
 * Ensures profile name is non-empty and all targets are valid.
 */
export const formProfileSchema = z.object({
  name: z.string().min(1, "Profile name cannot be empty"),
  description: z.string(),
  targets: z.record(z.string(), metricTargetSchema),
});

/**
 * Zod schema for comparison summary.
 * Ensures counts are non-negative integers.
 */
export const comparisonSummarySchema = z.object({
  passCount: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  priorityIssues: z.array(z.string()).readonly(),
});

/**
 * Zod schema for individual metric comparison result.
 */
export const metricComparisonResultSchema = z.object({
  value: z.union([z.number(), z.string()]),
  target: metricTargetSchema,
  status: comparisonStatusSchema,
  deviation: z.number().optional(),
  feedback: z.string().optional(),
});

/**
 * Zod schema for complete profile comparison result.
 */
export const profileComparisonSchema = z.object({
  profile: z.string().min(1, "Profile name cannot be empty"),
  metrics: z.record(z.string(), metricComparisonResultSchema),
  summary: comparisonSummarySchema,
});

/**
 * Type inferred from the FormProfile Zod schema.
 */
export type ValidatedFormProfile = z.infer<typeof formProfileSchema>;

/**
 * Type inferred from the ProfileComparison Zod schema.
 */
export type ValidatedProfileComparison = z.infer<typeof profileComparisonSchema>;

/**
 * Result type for safe profile validation.
 */
export type SafeValidateProfileResult =
  | { success: true; data: ValidatedFormProfile }
  | { success: false; error: z.ZodError };

/**
 * Result type for safe profile comparison validation.
 */
export type SafeValidateComparisonResult =
  | { success: true; data: ValidatedProfileComparison }
  | { success: false; error: z.ZodError };

/**
 * Validates a FormProfile object.
 *
 * @param profile - The profile to validate
 * @returns The validated profile
 * @throws {z.ZodError} If validation fails
 */
export function validateProfile(profile: unknown): ValidatedFormProfile {
  return formProfileSchema.parse(profile);
}

/**
 * Safely validates a FormProfile object without throwing.
 *
 * @param profile - The profile to validate
 * @returns A result object with success status and data/error
 */
export function safeValidateProfile(profile: unknown): SafeValidateProfileResult {
  return formProfileSchema.safeParse(profile);
}

/**
 * Validates a ProfileComparison object.
 *
 * @param comparison - The comparison result to validate
 * @returns The validated comparison
 * @throws {z.ZodError} If validation fails
 */
export function validateComparison(
  comparison: unknown,
): ValidatedProfileComparison {
  return profileComparisonSchema.parse(comparison);
}

/**
 * Safely validates a ProfileComparison object without throwing.
 *
 * @param comparison - The comparison result to validate
 * @returns A result object with success status and data/error
 */
export function safeValidateComparison(
  comparison: unknown,
): SafeValidateComparisonResult {
  return profileComparisonSchema.safeParse(comparison);
}
