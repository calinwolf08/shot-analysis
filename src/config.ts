/**
 * Configuration types and validation for the basketball shot analysis module.
 */

import { z } from 'zod';
import type { ShootingHand, TimingUnit, NumericRange, MetricPriority } from './types';

/**
 * Target specification for a single metric in a form profile.
 */
export interface MetricTarget {
  /** Ideal value for this metric */
  readonly ideal: number | string;
  /** Acceptable range (for numeric) or values (for categorical) */
  readonly acceptable: NumericRange | readonly string[];
  /** Priority level for feedback */
  readonly priority: MetricPriority;
  /** Feedback messages for deviations */
  readonly feedback: {
    readonly tooLow?: string;
    readonly tooHigh?: string;
    readonly incorrect?: string;
  };
}

/**
 * A form profile defining target metrics for shot analysis comparison.
 */
export interface FormProfile {
  /** Profile name (must be non-empty) */
  readonly name: string;
  /** Profile description */
  readonly description: string;
  /** Target values for each metric */
  readonly targets: Readonly<Record<string, MetricTarget>>;
}

/**
 * Configuration for the shot analyzer.
 */
export interface AnalysisConfig {
  /** Which hand the shooter uses for shooting */
  readonly shootingHand: ShootingHand;
  /** Name of the profile to use for comparison */
  readonly profile: string;
  /** Optional custom profile to override built-in profiles */
  readonly customProfile?: FormProfile | undefined;
  /** Minimum confidence threshold for including landmarks (0-1) */
  readonly minConfidenceThreshold: number;
  /** Unit for timing outputs */
  readonly outputTimingUnit: TimingUnit;
}

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
}).refine(
  (data) => data.min <= data.max,
  { message: 'min must be less than or equal to max' }
);

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
 * Type inferred from the Zod schema (useful for validation).
 */
export type ValidatedAnalysisConfig = z.infer<typeof analysisConfigSchema>;

/**
 * Validates an AnalysisConfig object.
 * @param config - The configuration to validate
 * @returns The validated configuration
 * @throws {z.ZodError} If validation fails
 */
export function validateConfig(config: unknown): ValidatedAnalysisConfig {
  return analysisConfigSchema.parse(config);
}

/**
 * Result type for safe validation.
 */
export type SafeValidateResult =
  | { success: true; data: ValidatedAnalysisConfig }
  | { success: false; error: z.ZodError };

/**
 * Safely validates an AnalysisConfig object without throwing.
 * @param config - The configuration to validate
 * @returns A result object with success status and data/error
 */
export function safeValidateConfig(config: unknown): SafeValidateResult {
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
} as const satisfies Omit<AnalysisConfig, 'customProfile'>;

/**
 * Creates a configuration with defaults for any missing values.
 * @param partial - Partial configuration object
 * @returns Complete configuration with defaults applied
 */
export function createConfig(partial: Partial<AnalysisConfig> = {}): ValidatedAnalysisConfig {
  const merged = { ...DEFAULT_CONFIG, ...partial };
  return validateConfig(merged);
}

/**
 * Creates a default configuration with all default values.
 * This is a convenience function that calls createConfig with no arguments.
 * @returns Complete configuration with all default values
 */
export function createDefaultConfig(): ValidatedAnalysisConfig {
  return createConfig();
}

/**
 * Landmark indices mapping for handedness-aware analysis.
 */
export interface HandednessMapping {
  /** Shooting arm shoulder landmark index */
  readonly shootingShoulder: number;
  /** Shooting arm elbow landmark index */
  readonly shootingElbow: number;
  /** Shooting arm wrist landmark index */
  readonly shootingWrist: number;
  /** Guide arm shoulder landmark index */
  readonly guideShoulder: number;
  /** Guide arm elbow landmark index */
  readonly guideElbow: number;
  /** Guide arm wrist landmark index */
  readonly guideWrist: number;
}

/**
 * MediaPipe landmark indices for left side of body.
 */
const LEFT_SIDE_INDICES = {
  shoulder: 11,
  elbow: 13,
  wrist: 15
} as const;

/**
 * MediaPipe landmark indices for right side of body.
 */
const RIGHT_SIDE_INDICES = {
  shoulder: 12,
  elbow: 14,
  wrist: 16
} as const;

/**
 * Returns the landmark indices mapping based on shooter handedness.
 * For a right-handed shooter, the shooting arm uses right-side landmarks.
 * For a left-handed shooter, the shooting arm uses left-side landmarks.
 *
 * @param shootingHand - Which hand the shooter uses for shooting ('left' or 'right')
 * @returns HandednessMapping with correct landmark indices for shooting and guide arms
 */
export function getHandednessMapping(shootingHand: ShootingHand): HandednessMapping {
  if (shootingHand === 'right') {
    return {
      shootingShoulder: RIGHT_SIDE_INDICES.shoulder,
      shootingElbow: RIGHT_SIDE_INDICES.elbow,
      shootingWrist: RIGHT_SIDE_INDICES.wrist,
      guideShoulder: LEFT_SIDE_INDICES.shoulder,
      guideElbow: LEFT_SIDE_INDICES.elbow,
      guideWrist: LEFT_SIDE_INDICES.wrist
    };
  } else {
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
