/**
 * LiveShotPipeline — the swappable "process one rep window" interface the live
 * store (step 5) depends on, with two interchangeable implementations:
 *
 *   • local  — analyze + score ON DEVICE (shared core), persist via a ShotStore
 *              (remote repos → the server). Default: lower latency, less server
 *              CPU, a step toward offline.
 *   • server — POST the pose window to /api/analysis/live-shot; the server runs
 *              the SAME core + persists. The authoritative path, kept swappable.
 *
 * Both return the same shape, so the caller is agnostic to where analysis ran.
 * The location is chosen like `selectAnalysisService` (?analysis=server /
 * VITE_LIVE_ANALYSIS=server), defaulting to on-device.
 *
 * @see docs/live-redesign-plan.md §3.5–3.6
 */
import type { PoseData } from "basketball-shot-analysis";
import type { ApiClient } from "$lib/shared/api/client";
import type { AnalyzeOptions } from "$lib/features/analysis";
import type { MetricDeviation, ShotScorecard } from "$lib/features/scoring";
import type { LiveTargets } from "$lib/features/scoring";
import type { ShotRecord } from "$lib/shared/db/repos";
import { analyzeAndScore } from "./core";
import type { ShotStore } from "./shot-store";

export interface ProcessInput {
  readonly playerId: string;
  readonly poseData: PoseData;
  /** Analysis options for the player (shooting hand + profile). */
  readonly opts: AnalyzeOptions;
}

export interface ProcessedShot {
  readonly shot: ShotRecord;
  readonly scorecard: ShotScorecard;
  readonly worst: readonly MetricDeviation[];
}

export type PipelineLocation = "device" | "server";

export interface LiveShotPipeline {
  readonly location: PipelineLocation;
  /** Analyze + score + persist one rep window; returns the detected shots. */
  process(input: ProcessInput): Promise<ProcessedShot[]>;
}

/** On-device analysis; persistence via the supplied store. */
export function createLocalPipeline(deps: {
  targets: LiveTargets;
  store: ShotStore;
}): LiveShotPipeline {
  return {
    location: "device",
    async process({ playerId, poseData, opts }) {
      const scored = analyzeAndScore(poseData, opts, deps.targets);
      const out: ProcessedShot[] = [];
      for (const s of scored) {
        const shot = await deps.store.save({ playerId, analysis: s.analysis });
        out.push({ shot, scorecard: s.scorecard, worst: s.worst });
      }
      return out;
    },
  };
}

/** Server-side analysis: forward the pose window to the live-shot endpoint. */
export function createServerPipeline(deps: {
  api: ApiClient;
}): LiveShotPipeline {
  return {
    location: "server",
    async process({ playerId, poseData }) {
      const { shots } = await deps.api.send<{ shots: ProcessedShot[] }>(
        "/api/analysis/live-shot",
        { playerId, poseData },
      );
      return shots;
    },
  };
}

/** Reads the configured analysis location (URL param or build env). */
export function resolvePipelineLocation(): PipelineLocation {
  const fromUrl =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("analysis")
      : null;
  const fromEnv = import.meta.env.VITE_LIVE_ANALYSIS as string | undefined;
  return (fromUrl ?? fromEnv) === "server" ? "server" : "device";
}

/** Builds the configured pipeline; on-device by default. */
export function createLiveShotPipeline(deps: {
  targets: LiveTargets;
  store: ShotStore;
  api: ApiClient;
  location?: PipelineLocation;
}): LiveShotPipeline {
  const location = deps.location ?? resolvePipelineLocation();
  return location === "server"
    ? createServerPipeline({ api: deps.api })
    : createLocalPipeline({ targets: deps.targets, store: deps.store });
}
