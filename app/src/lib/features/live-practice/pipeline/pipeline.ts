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
import type { KeyframeTargets } from "basketball-shot-analysis";
import type {
  CheckResult,
  KeyframeScorecard,
} from "$lib/features/scoring/keyframes";
import type { ShotRecord } from "$lib/shared/db/repos";
import { analyzeAndScore, type RejectedShot } from "./core";
import type { ShotStore } from "./shot-store";

export interface ProcessInput {
  readonly playerId: string;
  readonly poseData: PoseData;
  /** Analysis options for the player (shooting hand + profile). */
  readonly opts: AnalyzeOptions;
  /** Posed-frame index of the rep trigger (keeps only that rep's shot). */
  readonly focusIndex?: number;
  /** Ms of the rep's pre-roll with no frames (see analyzeAndScore). */
  readonly missedStartMs?: number;
}

export interface ProcessedShot {
  readonly shot: ShotRecord;
  /** Every check, unfiltered (the caller applies the feedback filter). */
  readonly scorecard: KeyframeScorecard;
  readonly worst: readonly CheckResult[];
}

export interface ProcessResult {
  /** Detected shots that passed the orientation gate: scored + persisted. */
  readonly shots: ProcessedShot[];
  /** Detected shots rejected before scoring (wrong camera angle). */
  readonly rejected: RejectedShot[];
}

export type PipelineLocation = "device" | "server";

export interface LiveShotPipeline {
  readonly location: PipelineLocation;
  /** Analyze + gate + score + persist one rep window. */
  process(input: ProcessInput): Promise<ProcessResult>;
}

/** On-device analysis; persistence via the supplied store. */
export function createLocalPipeline(deps: {
  targets: KeyframeTargets;
  store: ShotStore;
}): LiveShotPipeline {
  return {
    location: "device",
    async process({ playerId, poseData, opts, focusIndex, missedStartMs }) {
      const { shots: scored, rejected } = analyzeAndScore(
        poseData,
        opts,
        deps.targets,
        undefined,
        focusIndex,
        missedStartMs,
      );
      const out: ProcessedShot[] = [];
      for (const s of scored) {
        const shot = await deps.store.save({
          playerId,
          analysis: s.analysis,
          reviewPoses: s.reviewPoses,
        });
        out.push({ shot, scorecard: s.scorecard, worst: s.worst });
      }
      return { shots: out, rejected };
    },
  };
}

/** Server-side analysis: forward the pose window to the live-shot endpoint. */
export function createServerPipeline(deps: {
  api: ApiClient;
}): LiveShotPipeline {
  return {
    location: "server",
    async process({ playerId, poseData, focusIndex, missedStartMs }) {
      const res = await deps.api.send<ProcessResult>(
        "/api/analysis/live-shot",
        {
          playerId,
          poseData,
          ...(focusIndex !== undefined ? { focusIndex } : {}),
          ...(missedStartMs ? { missedStartMs } : {}),
        },
      );
      return { shots: res.shots, rejected: res.rejected ?? [] };
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
  targets: KeyframeTargets;
  store: ShotStore;
  api: ApiClient;
  location?: PipelineLocation;
}): LiveShotPipeline {
  const location = deps.location ?? resolvePipelineLocation();
  return location === "server"
    ? createServerPipeline({ api: deps.api })
    : createLocalPipeline({ targets: deps.targets, store: deps.store });
}
