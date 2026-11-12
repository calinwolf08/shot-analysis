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
import type { PoseData, ShotAnalysis } from "basketball-shot-analysis";
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
import type { ReviewPoseFrame, ShotReviewPoses } from "$lib/shared/db/repos";

export interface ScoredShot {
  /** The full analysis for one detected shot (incl. v2 metrics + keyframes). */
  readonly analysis: StoredShotAnalysis;
  readonly scorecard: ShotScorecard;
  readonly worst: readonly MetricDeviation[];
  /**
   * Analysis-aligned 2D skeleton track for the shot (for scrub review).
   * Frame indexes match the analysis keyframes + metric frame refs.
   */
  readonly reviewPoses: ShotReviewPoses;
}

/**
 * The filtered, rebased 2D landmark track for the whole window — mirrors the
 * replay pipeline's `prepare` (drop no-pose frames, reindex from 0), so the
 * indexes line up with `analysis.frameRange` / keyframes / metric frames.
 */
function filteredReviewFrames(pose: PoseData): ReviewPoseFrame[] {
  const out: ReviewPoseFrame[] = [];
  for (const f of poseDataToLandmarkFrames(pose)) {
    if (!f.landmarks || f.landmarks.length === 0) continue;
    out.push({
      frameIndex: out.length,
      landmarks: f.landmarks.map((l) => ({
        x: l.x,
        y: l.y,
        visibility: l.visibility,
      })),
    });
  }
  return out;
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
  const allFrames = filteredReviewFrames(pose);
  return result.shots.map((a) => {
    const analysis = a as StoredShotAnalysis;
    const scorecard = analysis.v2Metrics
      ? scoreShotDeviation(analysis.v2Metrics, targets)
      : scoreDeviation([], targets);
    const reviewPoses: ShotReviewPoses = {
      fps: pose.fps,
      frames: allFrames.slice(
        analysis.frameRange.start,
        analysis.frameRange.end + 1,
      ),
    };
    return { analysis, scorecard, worst: scorecard.worst, reviewPoses };
  });
}

/**
 * Recomputes a stored shot's deviation scorecard from its persisted v2 metrics
 * against the current targets — the read-side path for the Shots list, review,
 * and Insights (score is recomputed, never stored; see docs/live-redesign-plan
 * §3.5). Returns an empty scorecard when the shot carries no v2 metrics.
 */
export function scorecardForShot(
  analysis: ShotAnalysis,
  targets: LiveTargets,
): ShotScorecard {
  const v2 = (analysis as StoredShotAnalysis).v2Metrics;
  return v2 ? scoreShotDeviation(v2, targets) : scoreDeviation([], targets);
}
