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
export declare const metricPrioritySchema: z.ZodEnum<["high", "medium", "low"]>;
/**
 * Zod schema for ComparisonStatus.
 */
export declare const comparisonStatusSchema: z.ZodEnum<["pass", "fail", "warning"]>;
/**
 * Zod schema for numeric range validation.
 * Ensures min is less than or equal to max.
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
 * Zod schema for feedback messages.
 * All fields are optional as defaults can be used.
 */
export declare const metricFeedbackSchema: z.ZodObject<{
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
/**
 * Zod schema for metric target validation.
 * Supports both numeric (range) and categorical (string array) acceptable values.
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
 * Ensures profile name is non-empty and all targets are valid.
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
 * Zod schema for comparison summary.
 * Ensures counts are non-negative integers.
 */
export declare const comparisonSummarySchema: z.ZodObject<{
    passCount: z.ZodNumber;
    failCount: z.ZodNumber;
    warningCount: z.ZodNumber;
    priorityIssues: z.ZodReadonly<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    passCount: number;
    failCount: number;
    warningCount: number;
    priorityIssues: readonly string[];
}, {
    passCount: number;
    failCount: number;
    warningCount: number;
    priorityIssues: readonly string[];
}>;
/**
 * Zod schema for individual metric comparison result.
 */
export declare const metricComparisonResultSchema: z.ZodObject<{
    value: z.ZodUnion<[z.ZodNumber, z.ZodString]>;
    target: z.ZodObject<{
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
    status: z.ZodEnum<["pass", "fail", "warning"]>;
    deviation: z.ZodOptional<z.ZodNumber>;
    feedback: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value: string | number;
    status: "pass" | "fail" | "warning";
    target: {
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
    };
    feedback?: string | undefined;
    deviation?: number | undefined;
}, {
    value: string | number;
    status: "pass" | "fail" | "warning";
    target: {
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
    };
    feedback?: string | undefined;
    deviation?: number | undefined;
}>;
/**
 * Zod schema for complete profile comparison result.
 */
export declare const profileComparisonSchema: z.ZodObject<{
    profile: z.ZodString;
    metrics: z.ZodRecord<z.ZodString, z.ZodObject<{
        value: z.ZodUnion<[z.ZodNumber, z.ZodString]>;
        target: z.ZodObject<{
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
        status: z.ZodEnum<["pass", "fail", "warning"]>;
        deviation: z.ZodOptional<z.ZodNumber>;
        feedback: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: string | number;
        status: "pass" | "fail" | "warning";
        target: {
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
        };
        feedback?: string | undefined;
        deviation?: number | undefined;
    }, {
        value: string | number;
        status: "pass" | "fail" | "warning";
        target: {
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
        };
        feedback?: string | undefined;
        deviation?: number | undefined;
    }>>;
    summary: z.ZodObject<{
        passCount: z.ZodNumber;
        failCount: z.ZodNumber;
        warningCount: z.ZodNumber;
        priorityIssues: z.ZodReadonly<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        passCount: number;
        failCount: number;
        warningCount: number;
        priorityIssues: readonly string[];
    }, {
        passCount: number;
        failCount: number;
        warningCount: number;
        priorityIssues: readonly string[];
    }>;
}, "strip", z.ZodTypeAny, {
    metrics: Record<string, {
        value: string | number;
        status: "pass" | "fail" | "warning";
        target: {
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
        };
        feedback?: string | undefined;
        deviation?: number | undefined;
    }>;
    profile: string;
    summary: {
        passCount: number;
        failCount: number;
        warningCount: number;
        priorityIssues: readonly string[];
    };
}, {
    metrics: Record<string, {
        value: string | number;
        status: "pass" | "fail" | "warning";
        target: {
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
        };
        feedback?: string | undefined;
        deviation?: number | undefined;
    }>;
    profile: string;
    summary: {
        passCount: number;
        failCount: number;
        warningCount: number;
        priorityIssues: readonly string[];
    };
}>;
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
export type SafeValidateProfileResult = {
    success: true;
    data: ValidatedFormProfile;
} | {
    success: false;
    error: z.ZodError;
};
/**
 * Result type for safe profile comparison validation.
 */
export type SafeValidateComparisonResult = {
    success: true;
    data: ValidatedProfileComparison;
} | {
    success: false;
    error: z.ZodError;
};
/**
 * Validates a FormProfile object.
 *
 * @param profile - The profile to validate
 * @returns The validated profile
 * @throws {z.ZodError} If validation fails
 */
export declare function validateProfile(profile: unknown): ValidatedFormProfile;
/**
 * Safely validates a FormProfile object without throwing.
 *
 * @param profile - The profile to validate
 * @returns A result object with success status and data/error
 */
export declare function safeValidateProfile(profile: unknown): SafeValidateProfileResult;
/**
 * Validates a ProfileComparison object.
 *
 * @param comparison - The comparison result to validate
 * @returns The validated comparison
 * @throws {z.ZodError} If validation fails
 */
export declare function validateComparison(comparison: unknown): ValidatedProfileComparison;
/**
 * Safely validates a ProfileComparison object without throwing.
 *
 * @param comparison - The comparison result to validate
 * @returns A result object with success status and data/error
 */
export declare function safeValidateComparison(comparison: unknown): SafeValidateComparisonResult;
//# sourceMappingURL=schemas.d.ts.map