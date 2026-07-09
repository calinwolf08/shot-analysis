import { z } from "zod";
import { metricNameSchema } from "$lib/features/benchmarks";
import { ISSUE_GROUPS } from "$lib/features/diagnosis";

export const drillSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  description: z.string().min(10),
  /** PLACEHOLDER: LLM-drafted, flagged for coach review. */
  coachingPoints: z.array(z.string().min(5)).min(2),
  focusMetrics: z.array(metricNameSchema).min(1),
  issueGroups: z.array(z.enum(ISSUE_GROUPS)).min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  durationMin: z.number().int().positive(),
  equipment: z.array(z.string()),
  setsReps: z.string().min(1),
  videoUri: z.string().min(1),
  thumbnailUri: z.string().min(1),
  isPlaceholder: z.boolean(),
});

export type Drill = z.infer<typeof drillSchema>;

export const drillFileSchema = z.object({
  version: z.number().int().positive(),
  drills: z.array(drillSchema).min(1),
});

export type DrillFile = z.infer<typeof drillFileSchema>;

export class InvalidDrillError extends Error {
  constructor(details: string) {
    super(`Invalid drill content: ${details}`);
    this.name = "InvalidDrillError";
  }
}

export function parseDrillFile(data: unknown): DrillFile {
  const result = drillFileSchema.safeParse(data);
  if (!result.success) throw new InvalidDrillError(result.error.message);
  return result.data;
}
