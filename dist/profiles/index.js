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
//# sourceMappingURL=index.js.map