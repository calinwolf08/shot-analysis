import { z } from "zod";

/**
 * The canonical benchmarked metric set: the 26 metrics the library's form
 * profiles target. (The analyzer additionally emits `releasePoint`, which
 * has no benchmark target and is ignored by scoring — see deviations.)
 */
export const METRIC_NAMES = [
  "shootingElbowFlare",
  "shootingElbowAngle",
  "maxArmExtension",
  "wristSnapAngle",
  "followThroughHold",
  "guideElbowFlare",
  "guideHandPosition",
  "guideHandRelease",
  "ballDip",
  "ballPath",
  "setPointHeight",
  "setPointDuration",
  "releaseAngle",
  "ballBehindHead",
  "handCupVsHinge",
  "hipDrop",
  "kneeFlexion",
  "legExtensionStart",
  "backPosture",
  "headTilt",
  "shoulderAlignment",
  "ballRiseStart",
  "legRiseStart",
  "ballLegSync",
  "releaseStart",
  "totalShotDuration",
] as const;

export type MetricName = (typeof METRIC_NAMES)[number];

export const METRIC_CATEGORIES = [
  "shooting-arm",
  "guide-arm",
  "ball",
  "lower-body",
  "posture",
  "timing",
] as const;

export type MetricCategory = (typeof METRIC_CATEGORIES)[number];

export const metricNameSchema = z.enum(METRIC_NAMES);
export const metricCategorySchema = z.enum(METRIC_CATEGORIES);

const populationStatsSchema = z
  .object({
    mean: z.number(),
    std: z.number().nonnegative(),
    n: z.number().int().positive(),
  })
  .nullable();

export const benchmarkTargetSchema = z
  .object({
    ideal: z.union([z.number(), z.string()]),
    acceptable: z.union([
      z.object({ min: z.number(), max: z.number() }),
      z.array(z.string()).min(1),
    ]),
    priority: z.enum(["high", "medium", "low"]),
    populationStats: populationStatsSchema,
    feedback: z.object({
      tooLow: z.string().optional(),
      tooHigh: z.string().optional(),
      incorrect: z.string().optional(),
    }),
    displayName: z.string().min(1),
    /** Imperative, ≤ 4 words — spoken aloud between reps. */
    shortCue: z
      .string()
      .min(1)
      .refine((s) => s.trim().split(/\s+/).length <= 4, {
        message: "shortCue must be at most 4 words",
      }),
    category: metricCategorySchema,
    explanation: z.string().min(1),
  })
  .superRefine((target, ctx) => {
    const numericIdeal = typeof target.ideal === "number";
    const numericRange = !Array.isArray(target.acceptable);
    if (numericIdeal !== numericRange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "numeric ideal requires {min,max} acceptable; categorical ideal requires string[]",
      });
    }
    if (
      numericIdeal &&
      !Array.isArray(target.acceptable) &&
      (target.acceptable.min > (target.ideal as number) ||
        target.acceptable.max < (target.ideal as number))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ideal must lie inside the acceptable range",
      });
    }
  });

export type BenchmarkTarget = z.infer<typeof benchmarkTargetSchema>;

export const benchmarkProfileSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.number().int().positive(),
    isPlaceholder: z.boolean(),
    basedOn: z.string().min(1),
    targets: z.record(metricNameSchema, benchmarkTargetSchema),
  })
  .superRefine((profile, ctx) => {
    for (const name of METRIC_NAMES) {
      if (!(name in profile.targets)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `missing target for metric ${name}`,
        });
      }
    }
  });

export type BenchmarkProfile = z.infer<typeof benchmarkProfileSchema>;

export class InvalidBenchmarkError extends Error {
  constructor(
    public readonly benchmarkId: string,
    public readonly issues: string,
  ) {
    super(`Invalid benchmark ${benchmarkId}: ${issues}`);
    this.name = "InvalidBenchmarkError";
  }
}

export function parseBenchmarkProfile(
  data: unknown,
  idHint = "unknown",
): BenchmarkProfile {
  const result = benchmarkProfileSchema.safeParse(data);
  if (!result.success) {
    throw new InvalidBenchmarkError(idHint, result.error.message);
  }
  return result.data;
}
