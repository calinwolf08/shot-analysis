/**
 * Zod-validated message protocol between WorkerAnalysisService (main
 * thread) and analysis.worker.ts. Frames carry RGBA pixel buffers
 * (transferred, not copied).
 */
import { z } from "zod";
import type { AnalysisResult } from "basketball-shot-analysis";
import type { AnalysisProgress, LandmarkFrame } from "../types";

const analyzeOptionsSchema = z.object({
  shootingHand: z.enum(["left", "right"]),
  profile: z.string().min(1),
});

/** RGBA frame payload; `data` is transferred as an ArrayBuffer view. */
const framePayloadSchema = z.object({
  data: z.custom<Uint8ClampedArray>(
    (v) => v instanceof Uint8ClampedArray && v.length > 0,
    "expected non-empty Uint8ClampedArray",
  ),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frameIndex: z.number().int().nonnegative(),
  timestamp: z.number().nonnegative(),
});
export type FramePayload = z.infer<typeof framePayloadSchema>;

export const toWorkerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("init"),
    opts: analyzeOptionsSchema,
    mode: z.enum(["video", "live"]),
    fps: z.number().positive(),
    assets: z.object({
      wasmBasePath: z.string(),
      modelPath: z.string(),
    }),
  }),
  z.object({
    type: z.literal("frames"),
    frames: z.array(framePayloadSchema).min(1),
  }),
  z.object({ type: z.literal("finalize") }),
  // Like finalize, but returns the collected pose frames (for server-side
  // analysis) instead of running the pipeline in the worker.
  z.object({ type: z.literal("finalizePoses") }),
  z.object({ type: z.literal("cancel") }),
]);
export type ToWorkerMessage = z.infer<typeof toWorkerSchema>;

const progressSchema = z.object({
  framesProcessed: z.number().int().nonnegative(),
  totalFrames: z.number().int().nonnegative().optional(),
  shotsDetected: z.number().int().nonnegative(),
  phase: z.enum(["loading", "detecting", "extracting"]),
}) satisfies z.ZodType<AnalysisProgress>;

const landmarkFrameSchema = z.object({
  frameIndex: z.number().int().nonnegative(),
  timestamp: z.number().nonnegative(),
  poseConfidence: z.number(),
  landmarks: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
        visibility: z.number(),
        confidence: z.number(),
      }),
    )
    .nullable(),
}) satisfies z.ZodType<LandmarkFrame>;

/** Result validated structurally (full AnalysisResult schema lives in the library types). */
const resultSchema = z.object({
  shots: z.array(z.unknown()),
  videoMetadata: z.object({
    fps: z.number(),
    totalFrames: z.number(),
    duration: z.number(),
  }),
  config: z.unknown(),
});

/** Pose frames returned for server-side analysis (library PoseData shape). */
const poseDataSchema = z.object({
  video: z.string(),
  fps: z.number(),
  totalFrames: z.number(),
  width: z.number(),
  height: z.number(),
  extractedAt: z.string(),
  frames: z.array(z.unknown()),
});

export const fromWorkerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("progress"), progress: progressSchema }),
  z.object({ type: z.literal("landmarks"), frame: landmarkFrameSchema }),
  z.object({ type: z.literal("result"), result: resultSchema }),
  z.object({ type: z.literal("poses"), poseData: poseDataSchema }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type FromWorkerMessage = z.infer<typeof fromWorkerSchema>;

export function parseToWorker(data: unknown): ToWorkerMessage {
  return toWorkerSchema.parse(data);
}

export function parseFromWorker(data: unknown): FromWorkerMessage {
  return fromWorkerSchema.parse(data);
}

/** Narrow a validated result back to the library type. */
export function asAnalysisResult(
  result: z.infer<typeof resultSchema>,
): AnalysisResult {
  return result as unknown as AnalysisResult;
}
