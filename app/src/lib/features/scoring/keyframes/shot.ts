/**
 * Keyframe checks for a stored shot. The ONE place they're computed from a
 * shot's review pose track — live (right after analysis) and on read for
 * shots analyzed before they existed — so a recompute equals what live stored.
 *
 * Pure.
 */
import {
  KEYFRAME_SCHEMA_VERSION,
  computeShotKeyframes,
  type KeyframeTargets,
  type ShotAnalysis,
  type ShotKeyframes,
  type SignalFrame,
} from "basketball-shot-analysis";
import type { StoredShotAnalysis } from "$lib/features/analysis/replay/replay-pipeline";
import type { ShotReviewPoses } from "$lib/shared/db/repos";
import { poseAspect } from "../v3/shot";
import { scoreShotKeyframes, type KeyframeScorecard } from "./score";

/** Keyframe checks from a stored review pose track. */
export function keyframesForPoses(
  poses: ShotReviewPoses,
  shootingHand: "left" | "right",
): ShotKeyframes {
  const fps = poses.fps || 30;
  const frames: SignalFrame[] = poses.frames.map((f) => ({
    frameIndex: f.frameIndex,
    // Stored t is ms on the capture clock (the same clock v3 is fed).
    timestamp: f.t !== undefined ? f.t : (f.frameIndex / fps) * 1000,
    landmarks: f.landmarks,
  }));
  return computeShotKeyframes(frames, {
    aspect: poseAspect(poses),
    shootingHand,
  });
}

/** True when the shot's stored keyframe checks are the current definition. */
export function hasKeyframes(analysis: ShotAnalysis): boolean {
  const k = (analysis as StoredShotAnalysis).keyframes;
  return !!k && k.schemaVersion >= KEYFRAME_SCHEMA_VERSION;
}

/**
 * The analysis with keyframe checks: as stored, or recomputed from the pose
 * track (`recomputed: true` → the caller should persist it). Null when the
 * shot has none and no pose track to compute them from.
 */
export function ensureKeyframes(
  analysis: ShotAnalysis,
  poses: ShotReviewPoses | null,
  shootingHand: "left" | "right",
): { analysis: StoredShotAnalysis; recomputed: boolean } | null {
  const a = analysis as StoredShotAnalysis;
  if (hasKeyframes(a)) return { analysis: a, recomputed: false };
  if (!poses || poses.frames.length === 0) {
    // Outdated checks without a track: keep scoring what we have.
    return a.keyframes ? { analysis: a, recomputed: false } : null;
  }
  return {
    analysis: { ...a, keyframes: keyframesForPoses(poses, shootingHand) },
    recomputed: true,
  };
}

/** The shot's keyframe scorecard, or null when it has no keyframe checks. */
export function scorecardForStoredShot(
  analysis: ShotAnalysis,
  targets: KeyframeTargets,
  enabled?: ReadonlySet<string> | null,
): KeyframeScorecard | null {
  const k = (analysis as StoredShotAnalysis).keyframes;
  return k ? scoreShotKeyframes(k, targets, enabled) : null;
}
