/**
 * v3 metrics for a stored shot. The ONE place they're computed from a shot's
 * review pose track — used live (right after analysis) and on read for shots
 * analyzed before v3 existed — so a recompute always equals what live stored.
 *
 * Pure.
 */
import {
  computeShotMetricsV3,
  EVENT_PAD_AFTER,
  EVENT_PAD_BEFORE,
  type LiveTargetsV3,
  type ShotMetricsV3,
  type SignalFrame,
} from "basketball-shot-analysis";
import type { StoredShotAnalysis } from "$lib/features/analysis/replay/replay-pipeline";
import type { ShotAnalysis } from "basketball-shot-analysis";
import type { ShotReviewPoses } from "$lib/shared/db/repos";
import { estimateAspect } from "$lib/features/live-practice/review/framing";
import { scoreShotV3, type ScorecardV3 } from "./score";

/** Bumped from 1 (v2 metrics only) when a shot carries `v3Metrics`. */
export const METRICS_SCHEMA_VERSION = 2 as const;

/**
 * Frames of context stored around a shot's detected range, so v3 can find the
 * start of the load (before the v2 shot start) and arm extension (after it).
 */
export const POSE_PAD_BEFORE = EVENT_PAD_BEFORE;
export const POSE_PAD_AFTER = EVENT_PAD_AFTER;

/** Source aspect (width ÷ height) of a stored pose track. */
export function poseAspect(poses: ShotReviewPoses): number {
  return poses.width && poses.height
    ? poses.width / poses.height
    : (estimateAspect(poses.frames) ?? 16 / 9);
}

/** v3 metrics from a stored review pose track. */
export function v3ForPoses(
  poses: ShotReviewPoses,
  shootingHand: "left" | "right",
): ShotMetricsV3 {
  const fps = poses.fps || 30;
  const frames: SignalFrame[] = poses.frames.map((f) => ({
    frameIndex: f.frameIndex,
    // Stored t is ms on the capture clock; fall back to the frame index.
    timestamp: f.t !== undefined ? f.t : (f.frameIndex / fps) * 1000,
    landmarks: f.landmarks,
  }));
  return computeShotMetricsV3(frames, {
    aspect: poseAspect(poses),
    shootingHand,
  });
}

export function hasV3(analysis: ShotAnalysis): boolean {
  return !!(analysis as StoredShotAnalysis).v3Metrics;
}

/**
 * The analysis with v3 metrics: as stored, or recomputed from the pose track
 * (`recomputed: true` → the caller should persist it). Null when the shot has
 * no v3 metrics and no pose track to compute them from.
 */
export function ensureV3(
  analysis: ShotAnalysis,
  poses: ShotReviewPoses | null,
  shootingHand: "left" | "right",
): { analysis: StoredShotAnalysis; recomputed: boolean } | null {
  const a = analysis as StoredShotAnalysis;
  if (a.v3Metrics) return { analysis: a, recomputed: false };
  if (!poses || poses.frames.length === 0) return null;
  return {
    analysis: { ...a, v3Metrics: v3ForPoses(poses, shootingHand) },
    recomputed: true,
  };
}

/** The shot's v3 scorecard, or null when it has no v3 metrics. */
export function scorecardV3ForShot(
  analysis: ShotAnalysis,
  targets: LiveTargetsV3,
): ScorecardV3 | null {
  const v3 = (analysis as StoredShotAnalysis).v3Metrics;
  return v3 ? scoreShotV3(v3.metrics, targets) : null;
}
