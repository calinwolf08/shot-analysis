/**
 * Location-agnostic shot analysis + scoring core (live redesign — step 4).
 *
 * Runs the SAME isomorphic analysis pipeline the client replay and server paths
 * already share (`runReplayAnalysis`, depends only on `basketball-shot-analysis`)
 * over a pose window, then scores each detected shot's v2 metrics against the
 * live deviation targets. Identical output whether invoked in the browser
 * (on-device analysis) or on the server — the only thing that changes between
 * those is who calls this and where the result is persisted.
 *
 * Pure: no DB, network, or Svelte. The persistence + transport live in
 * `./pipeline` (LiveShotPipeline) and `./shot-store` (ShotStore).
 *
 * @see docs/live-redesign-plan.md §3.2, §3.5
 */
import type { PoseData } from "basketball-shot-analysis";
import {
  poseDataToLandmarkFrames,
  runReplayAnalysis,
  type StoredShotAnalysis,
} from "$lib/features/analysis/replay/replay-pipeline";
import type { AnalyzeOptions } from "$lib/features/analysis";
import {
  scoreDeviation,
  scoreShotDeviation,
  type LiveTargets,
  type MetricDeviation,
  type ShotScorecard,
} from "$lib/features/scoring";

export interface ScoredShot {
  /** The full analysis for one detected shot (incl. v2 metrics + keyframes). */
  readonly analysis: StoredShotAnalysis;
  readonly scorecard: ShotScorecard;
  readonly worst: readonly MetricDeviation[];
}

/**
 * Analyzes a pose window and scores each detected shot against the targets.
 * Reuses the already-computed `v2Metrics` on each analysis (no second
 * extraction); a shot missing v2 metrics yields an empty (uncovered) scorecard
 * rather than throwing.
 */
export function analyzeAndScore(
  pose: PoseData,
  opts: AnalyzeOptions,
  targets: LiveTargets,
): ScoredShot[] {
  const frames = poseDataToLandmarkFrames(pose);
  const result = runReplayAnalysis(frames, opts, {
    fps: pose.fps,
    width: pose.width,
    height: pose.height,
  });
  return result.shots.map((a) => {
    const analysis = a as StoredShotAnalysis;
    const scorecard = analysis.v2Metrics
      ? scoreShotDeviation(analysis.v2Metrics, targets)
      : scoreDeviation([], targets);
    return { analysis, scorecard, worst: scorecard.worst };
  });
}
