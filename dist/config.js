/**
 * Configuration types and validation for the basketball shot analysis module.
 */
import { z } from 'zod';
/**
 * Zod schema for MetricPriority.
 */
export const metricPrioritySchema = z.enum(['high', 'medium', 'low']);
/**
 * Zod schema for numeric range validation.
 */
export const numericRangeSchema = z.object({
    min: z.number(),
    max: z.number()
}).refine((data) => data.min <= data.max, { message: 'min must be less than or equal to max' });
/**
 * Zod schema for metric target validation.
 */
export const metricTargetSchema = z.object({
    ideal: z.union([z.number(), z.string()]),
    acceptable: z.union([
        numericRangeSchema,
        z.array(z.string()).readonly()
    ]),
    priority: metricPrioritySchema,
    feedback: z.object({
        tooLow: z.string().optional(),
        tooHigh: z.string().optional(),
        incorrect: z.string().optional()
    })
});
/**
 * Zod schema for FormProfile validation.
 */
export const formProfileSchema = z.object({
    name: z.string().min(1, 'Profile name cannot be empty'),
    description: z.string(),
    targets: z.record(z.string(), metricTargetSchema)
});
/**
 * Zod schema for ShootingHand validation.
 */
export const shootingHandSchema = z.enum(['left', 'right']);
/**
 * Zod schema for TimingUnit validation.
 */
export const timingUnitSchema = z.enum(['frames', 'ms', 'percent']);
/**
 * Zod schema for AnalysisConfig validation.
 */
export const analysisConfigSchema = z.object({
    shootingHand: shootingHandSchema,
    profile: z.string().min(1, 'Profile name cannot be empty'),
    customProfile: formProfileSchema.optional(),
    minConfidenceThreshold: z.number()
        .min(0, 'minConfidenceThreshold must be at least 0')
        .max(1, 'minConfidenceThreshold must be at most 1'),
    outputTimingUnit: timingUnitSchema
});
/**
 * Validates an AnalysisConfig object.
 * @param config - The configuration to validate
 * @returns The validated configuration
 * @throws {z.ZodError} If validation fails
 */
export function validateConfig(config) {
    return analysisConfigSchema.parse(config);
}
/**
 * Safely validates an AnalysisConfig object without throwing.
 * @param config - The configuration to validate
 * @returns A result object with success status and data/error
 */
export function safeValidateConfig(config) {
    return analysisConfigSchema.safeParse(config);
}
/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG = {
    shootingHand: 'right',
    profile: 'youth-fundamentals',
    minConfidenceThreshold: 0.5,
    outputTimingUnit: 'percent'
};
/**
 * Creates a configuration with defaults for any missing values.
 * @param partial - Partial configuration object
 * @returns Complete configuration with defaults applied
 */
export function createConfig(partial = {}) {
    const merged = { ...DEFAULT_CONFIG, ...partial };
    return validateConfig(merged);
}
/**
 * Creates a default configuration with all default values.
 * This is a convenience function that calls createConfig with no arguments.
 * @returns Complete configuration with all default values
 */
export function createDefaultConfig() {
    return createConfig();
}
/**
 * MediaPipe landmark indices for left side of body.
 */
const LEFT_SIDE_INDICES = {
    shoulder: 11,
    elbow: 13,
    wrist: 15
};
/**
 * MediaPipe landmark indices for right side of body.
 */
const RIGHT_SIDE_INDICES = {
    shoulder: 12,
    elbow: 14,
    wrist: 16
};
/**
 * Returns the landmark indices mapping based on shooter handedness.
 * For a right-handed shooter, the shooting arm uses right-side landmarks.
 * For a left-handed shooter, the shooting arm uses left-side landmarks.
 *
 * @param shootingHand - Which hand the shooter uses for shooting ('left' or 'right')
 * @returns HandednessMapping with correct landmark indices for shooting and guide arms
 */
export function getHandednessMapping(shootingHand) {
    if (shootingHand === 'right') {
        return {
            shootingShoulder: RIGHT_SIDE_INDICES.shoulder,
            shootingElbow: RIGHT_SIDE_INDICES.elbow,
            shootingWrist: RIGHT_SIDE_INDICES.wrist,
            guideShoulder: LEFT_SIDE_INDICES.shoulder,
            guideElbow: LEFT_SIDE_INDICES.elbow,
            guideWrist: LEFT_SIDE_INDICES.wrist
        };
    }
    else {
        return {
            shootingShoulder: LEFT_SIDE_INDICES.shoulder,
            shootingElbow: LEFT_SIDE_INDICES.elbow,
            shootingWrist: LEFT_SIDE_INDICES.wrist,
            guideShoulder: RIGHT_SIDE_INDICES.shoulder,
            guideElbow: RIGHT_SIDE_INDICES.elbow,
            guideWrist: RIGHT_SIDE_INDICES.wrist
        };
    }
}
//# sourceMappingURL=config.js.map