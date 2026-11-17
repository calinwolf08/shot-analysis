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
import type { LandmarkFrame } from "$lib/features/analysis";
import { requiredOrientation } from "../setup/angle-gate";
import { detectLiveOrientation } from "../setup/live-orientation";
import { DEFAULT_LIVE_TUNING } from "../tuning";

/**
 * The camera orientations live practice accepts, for a shooting hand.
 *
 * CURRENTLY ONE: side-on with the shooting arm nearest the camera. Shots read
 * from any other angle (facing the camera, angled, behind, the guide-arm side)
 * are rejected before scoring and never stored. Code that handles other
 * orientations — the library's general `detectOrientation`, front-view metric
 * handling, the angle-gate's "turn around"/"side-on" messaging — is kept but
 * not reached from live practice. To re-enable a view, add it here (and give
 * it scoring targets measured from that view).
 */
export function allowedOrientations(hand: "left" | "right"): readonly string[] {
  return [requiredOrientation(hand)];
}

/** A detected shot that was not scored or stored. */
export interface RejectedShot {
  readonly reason: "orientation";
  /** What the shot read as (e.g. "front", "side-left"). */
  readonly orientation: string;
  readonly allowed: readonly string[];
}

export interface AnalyzeAndScoreResult {
  readonly shots: ScoredShot[];
  readonly rejected: RejectedShot[];
}

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
 *
 * Orientation gate: each shot's orientation is read with the side-aware live
 * detector (tolerant of the occluded far side) — the same reading drives the
 * v2 posture metrics — and shots outside `allowedOrientations` are returned in
 * `rejected` instead of `shots`.
 */
export function analyzeAndScore(
  pose: PoseData,
  opts: AnalyzeOptions,
  targets: LiveTargets,
  gate: { maxSideSeparation: number } = {
    maxSideSeparation: DEFAULT_LIVE_TUNING.readiness.maxSideSeparation,
  },
): AnalyzeAndScoreResult {
  const frames = poseDataToLandmarkFrames(pose);
  const allowed = allowedOrientations(opts.shootingHand);
  const result = runReplayAnalysis(frames, opts, {
    fps: pose.fps,
    width: pose.width,
    height: pose.height,
    orientationOf: (shotFrames) =>
      detectLiveOrientation(shotFrames as unknown as LandmarkFrame[], {
        maxSideSeparation: gate.maxSideSeparation,
      }).orientation as ShotAnalysis["orientation"],
  });
  const allFrames = filteredReviewFrames(pose);
  const rejected: RejectedShot[] = [];
  const kept = result.shots.filter((a) => {
    const o = a.orientation ?? "unknown";
    if (allowed.includes(o)) return true;
    rejected.push({ reason: "orientation", orientation: o, allowed });
    return false;
  });
  const shots = kept.map((a) => {
    const analysis = a as StoredShotAnalysis;
    const scorecard = analysis.v2Metrics
      ? scoreShotDeviation(analysis.v2Metrics, targets)
      : scoreDeviation([], targets);
    // Real dims only (1×1 is the "unknown" placeholder from PoseData).
    const dims =
      pose.width > 1 && pose.height > 1
        ? { width: pose.width, height: pose.height }
        : {};
    const reviewPoses: ShotReviewPoses = {
      fps: pose.fps,
      ...dims,
      frames: allFrames.slice(
        analysis.frameRange.start,
        analysis.frameRange.end + 1,
      ),
    };
    return { analysis, scorecard, worst: scorecard.worst, reviewPoses };
  });
  return { shots, rejected };
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
