/**
 * Configuration types and validation for the basketball shot analysis module.
 *
 * Known Limitations:
 * - Custom profiles are validated at runtime but not persisted; consumers must
 *   re-register custom profiles on each analyzer instantiation
 * - Profile target validation ensures structure but not semantic correctness
 *   (e.g., acceptable range min/max could be inverted or unreasonable values)
 * - Default profile 'youth-fundamentals' must exist when referenced;
 *   built-in profiles are implemented in Feature 6.0
 */
import { z } from "zod";
import type { ShootingHand, TimingUnit, NumericRange, MetricPriority } from "./types";
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
export declare const metricPrioritySchema: z.ZodEnum<["high", "medium", "low"]>;
/**
 * Zod schema for numeric range validation.
 */
export declare const numericRangeSchema: z.ZodEffects<z.ZodObject<{
    min: z.ZodNumber;
    max: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    min: number;
    max: number;
}, {
    min: number;
    max: number;
}>, {
    min: number;
    max: number;
}, {
    min: number;
    max: number;
}>;
/**
 * Zod schema for metric target validation.
 */
export declare const metricTargetSchema: z.ZodObject<{
    ideal: z.ZodUnion<[z.ZodNumber, z.ZodString]>;
    acceptable: z.ZodUnion<[z.ZodEffects<z.ZodObject<{
        min: z.ZodNumber;
        max: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        min: number;
        max: number;
    }, {
        min: number;
        max: number;
    }>, {
        min: number;
        max: number;
    }, {
        min: number;
        max: number;
    }>, z.ZodReadonly<z.ZodArray<z.ZodString, "many">>]>;
    priority: z.ZodEnum<["high", "medium", "low"]>;
    feedback: z.ZodObject<{
        tooLow: z.ZodOptional<z.ZodString>;
        tooHigh: z.ZodOptional<z.ZodString>;
        incorrect: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        tooLow?: string | undefined;
        tooHigh?: string | undefined;
        incorrect?: string | undefined;
    }, {
        tooLow?: string | undefined;
        tooHigh?: string | undefined;
        incorrect?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    ideal: string | number;
    acceptable: readonly string[] | {
        min: number;
        max: number;
    };
    priority: "high" | "medium" | "low";
    feedback: {
        tooLow?: string | undefined;
        tooHigh?: string | undefined;
        incorrect?: string | undefined;
    };
}, {
    ideal: string | number;
    acceptable: readonly string[] | {
        min: number;
        max: number;
    };
    priority: "high" | "medium" | "low";
    feedback: {
        tooLow?: string | undefined;
        tooHigh?: string | undefined;
        incorrect?: string | undefined;
    };
}>;
/**
 * Zod schema for FormProfile validation.
 */
export declare const formProfileSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    targets: z.ZodRecord<z.ZodString, z.ZodObject<{
        ideal: z.ZodUnion<[z.ZodNumber, z.ZodString]>;
        acceptable: z.ZodUnion<[z.ZodEffects<z.ZodObject<{
            min: z.ZodNumber;
            max: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            min: number;
            max: number;
        }, {
            min: number;
            max: number;
        }>, {
            min: number;
            max: number;
        }, {
            min: number;
            max: number;
        }>, z.ZodReadonly<z.ZodArray<z.ZodString, "many">>]>;
        priority: z.ZodEnum<["high", "medium", "low"]>;
        feedback: z.ZodObject<{
            tooLow: z.ZodOptional<z.ZodString>;
            tooHigh: z.ZodOptional<z.ZodString>;
            incorrect: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            tooLow?: string | undefined;
            tooHigh?: string | undefined;
            incorrect?: string | undefined;
        }, {
            tooLow?: string | undefined;
            tooHigh?: string | undefined;
            incorrect?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        ideal: string | number;
        acceptable: readonly string[] | {
            min: number;
            max: number;
        };
        priority: "high" | "medium" | "low";
        feedback: {
            tooLow?: string | undefined;
            tooHigh?: string | undefined;
            incorrect?: string | undefined;
        };
    }, {
        ideal: string | number;
        acceptable: readonly string[] | {
            min: number;
            max: number;
        };
        priority: "high" | "medium" | "low";
        feedback: {
            tooLow?: string | undefined;
            tooHigh?: string | undefined;
            incorrect?: string | undefined;
        };
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    targets: Record<string, {
        ideal: string | number;
        acceptable: readonly string[] | {
            min: number;
            max: number;
        };
        priority: "high" | "medium" | "low";
        feedback: {
            tooLow?: string | undefined;
            tooHigh?: string | undefined;
            incorrect?: string | undefined;
        };
    }>;
}, {
    name: string;
    description: string;
    targets: Record<string, {
        ideal: string | number;
        acceptable: readonly string[] | {
            min: number;
            max: number;
        };
        priority: "high" | "medium" | "low";
        feedback: {
            tooLow?: string | undefined;
            tooHigh?: string | undefined;
            incorrect?: string | undefined;
        };
    }>;
}>;
/**
 * Zod schema for ShootingHand validation.
 */
export declare const shootingHandSchema: z.ZodEnum<["left", "right"]>;
/**
 * Zod schema for TimingUnit validation.
 */
export declare const timingUnitSchema: z.ZodEnum<["frames", "ms", "percent"]>;
/**
 * Zod schema for AnalysisConfig validation.
 */
export declare const analysisConfigSchema: z.ZodObject<{
    shootingHand: z.ZodEnum<["left", "right"]>;
    profile: z.ZodString;
    customProfile: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        targets: z.ZodRecord<z.ZodString, z.ZodObject<{
            ideal: z.ZodUnion<[z.ZodNumber, z.ZodString]>;
            acceptable: z.ZodUnion<[z.ZodEffects<z.ZodObject<{
                min: z.ZodNumber;
                max: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                min: number;
                max: number;
            }, {
                min: number;
                max: number;
            }>, {
                min: number;
                max: number;
            }, {
                min: number;
                max: number;
            }>, z.ZodReadonly<z.ZodArray<z.ZodString, "many">>]>;
            priority: z.ZodEnum<["high", "medium", "low"]>;
            feedback: z.ZodObject<{
                tooLow: z.ZodOptional<z.ZodString>;
                tooHigh: z.ZodOptional<z.ZodString>;
                incorrect: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                tooLow?: string | undefined;
                tooHigh?: string | undefined;
                incorrect?: string | undefined;
            }, {
                tooLow?: string | undefined;
                tooHigh?: string | undefined;
                incorrect?: string | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            ideal: string | number;
            acceptable: readonly string[] | {
                min: number;
                max: number;
            };
            priority: "high" | "medium" | "low";
            feedback: {
                tooLow?: string | undefined;
                tooHigh?: string | undefined;
                incorrect?: string | undefined;
            };
        }, {
            ideal: string | number;
            acceptable: readonly string[] | {
                min: number;
                max: number;
            };
            priority: "high" | "medium" | "low";
            feedback: {
                tooLow?: string | undefined;
                tooHigh?: string | undefined;
                incorrect?: string | undefined;
            };
        }>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        targets: Record<string, {
            ideal: string | number;
            acceptable: readonly string[] | {
                min: number;
                max: number;
            };
            priority: "high" | "medium" | "low";
            feedback: {
                tooLow?: string | undefined;
                tooHigh?: string | undefined;
                incorrect?: string | undefined;
            };
        }>;
    }, {
        name: string;
        description: string;
        targets: Record<string, {
            ideal: string | number;
            acceptable: readonly string[] | {
                min: number;
                max: number;
            };
            priority: "high" | "medium" | "low";
            feedback: {
                tooLow?: string | undefined;
                tooHigh?: string | undefined;
                incorrect?: string | undefined;
            };
        }>;
    }>>;
    minConfidenceThreshold: z.ZodNumber;
    outputTimingUnit: z.ZodEnum<["frames", "ms", "percent"]>;
}, "strip", z.ZodTypeAny, {
    shootingHand: "left" | "right";
    profile: string;
    minConfidenceThreshold: number;
    outputTimingUnit: "frames" | "ms" | "percent";
    customProfile?: {
        name: string;
        description: string;
        targets: Record<string, {
            ideal: string | number;
            acceptable: readonly string[] | {
                min: number;
                max: number;
            };
            priority: "high" | "medium" | "low";
            feedback: {
                tooLow?: string | undefined;
                tooHigh?: string | undefined;
                incorrect?: string | undefined;
            };
        }>;
    } | undefined;
}, {
    shootingHand: "left" | "right";
    profile: string;
    minConfidenceThreshold: number;
    outputTimingUnit: "frames" | "ms" | "percent";
    customProfile?: {
        name: string;
        description: string;
        targets: Record<string, {
            ideal: string | number;
            acceptable: readonly string[] | {
                min: number;
                max: number;
            };
            priority: "high" | "medium" | "low";
            feedback: {
                tooLow?: string | undefined;
                tooHigh?: string | undefined;
                incorrect?: string | undefined;
            };
        }>;
    } | undefined;
}>;
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
export declare function validateConfig(config: unknown): ValidatedAnalysisConfig;
/**
 * Result type for safe validation.
 */
export type SafeValidateResult = {
    success: true;
    data: ValidatedAnalysisConfig;
} | {
    success: false;
    error: z.ZodError;
};
/**
 * Safely validates an AnalysisConfig object without throwing.
 * @param config - The configuration to validate
 * @returns A result object with success status and data/error
 */
export declare function safeValidateConfig(config: unknown): SafeValidateResult;
/**
 * Default configuration values.
 */
export declare const DEFAULT_CONFIG: {
    readonly shootingHand: "right";
    readonly profile: "youth-fundamentals";
    readonly minConfidenceThreshold: 0.5;
    readonly outputTimingUnit: "percent";
};
/**
 * Creates a configuration with defaults for any missing values.
 * @param partial - Partial configuration object
 * @returns Complete configuration with defaults applied
 */
export declare function createConfig(partial?: Partial<AnalysisConfig>): ValidatedAnalysisConfig;
/**
 * Creates a default configuration with all default values.
 * This is a convenience function that calls createConfig with no arguments.
 * @returns Complete configuration with all default values
 */
export declare function createDefaultConfig(): ValidatedAnalysisConfig;
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
 * Returns the landmark indices mapping based on shooter handedness.
 * For a right-handed shooter, the shooting arm uses right-side landmarks.
 * For a left-handed shooter, the shooting arm uses left-side landmarks.
 *
 * @param shootingHand - Which hand the shooter uses for shooting ('left' or 'right')
 * @returns HandednessMapping with correct landmark indices for shooting and guide arms
 */
export declare function getHandednessMapping(shootingHand: ShootingHand): HandednessMapping;
//# sourceMappingURL=config.d.ts.map