/**
 * Server-side full analysis.
 *
 * Runs the **exact same** deterministic pipeline the client replay path uses
 * (`runReplayAnalysis` + `poseDataToLandmarkFrames` — Node-safe, depends only on
 * `basketball-shot-analysis`), so pose frames captured on any client produce a
 * byte-identical `ShotAnalysis` on the server. The pipeline logic is untouched;
 * this module only adapts input (validated `PoseData`) → result.
 *
 * Server-only.
 */
import { poseDataSchema, type PoseData } from "basketball-shot-analysis";
import type { AnalysisResult } from "basketball-shot-analysis";
import type { AnalyzeOptions } from "$lib/features/analysis";
import {
  poseDataToLandmarkFrames,
  runReplayAnalysis,
} from "$lib/features/analysis/replay/replay-pipeline";

/**
 * Analyzes recorded pose frames. Mirrors
 * `ReplayAnalysisService.analyzeVideoFile`: convert PoseData → landmark frames,
 * then run the pipeline with the pose's own fps/dimensions.
 */
export function analyzePoseData(
  pose: PoseData,
  opts: AnalyzeOptions,
): AnalysisResult {
  const frames = poseDataToLandmarkFrames(pose);
  return runReplayAnalysis(frames, opts, {
    fps: pose.fps,
    width: pose.width,
    height: pose.height,
  });
}

/** Validates untrusted pose JSON from a request body (throws ZodError). */
export function parsePoseData(raw: unknown): PoseData {
  return poseDataSchema.parse(raw);
}
