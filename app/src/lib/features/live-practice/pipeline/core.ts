/**
 * Location-agnostic shot analysis + scoring core (live redesign — step 4).
 *
 * Runs the SAME isomorphic analysis pipeline the client replay and server paths
 * already share (`runReplayAnalysis`, depends only on `basketball-shot-analysis`)
 * over a pose window to detect each shot, then measures the keyframe checks
 * (from the shot's padded pose track) and scores them on the 0–10+ scale
 * against the keyframe targets. Identical output whether invoked in the browser
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
import type { KeyframeTargets, ShotKeyframes } from "basketball-shot-analysis";
import {
  POSE_PAD_AFTER,
  POSE_PAD_BEFORE,
  keyframesForPoses,
  scoreShotKeyframes,
  scorecardForStoredShot,
  type CheckResult,
  type KeyframeScorecard,
} from "$lib/features/scoring/keyframes";
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
  /** The full analysis for one detected shot (incl. keyframe checks). */
  readonly analysis: StoredShotAnalysis;
  /** Every check (the player's feedback filter is applied by the caller). */
  readonly scorecard: KeyframeScorecard;
  readonly worst: readonly CheckResult[];
  /**
   * Analysis-aligned 2D skeleton track for the shot (for scrub review), with
   * POSE_PAD_BEFORE / _AFTER frames of context so v3 can be recomputed from
   * it exactly. Frame indexes match the analysis + metric frame refs.
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
  const frames = poseDataToLandmarkFrames(pose);
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    if (!f.landmarks || f.landmarks.length === 0) continue;
    // PoseData keeps each frame's real capture time (seconds); the analysis
    // view above rebases to frameIndex/fps, so read the original here.
    const t = pose.frames[i]?.timestamp;
    out.push({
      frameIndex: out.length,
      ...(typeof t === "number" ? { t: t * 1000 } : {}),
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
 * Analyzes a pose window and scores each detected shot against the v3
 * targets. v3 is computed from the very pose track that's stored with the
 * shot, so a later recompute from storage gives the same numbers.
 *
 * Orientation gate: each shot's orientation is read with the side-aware live
 * detector (tolerant of the occluded far side) — the same reading drives the
 * v2 posture metrics — and shots outside `allowedOrientations` are returned in
 * `rejected` instead of `shots`.
 */
export function analyzeAndScore(
  pose: PoseData,
  opts: AnalyzeOptions,
  targets: KeyframeTargets,
  gate: { maxSideSeparation: number } = {
    maxSideSeparation: DEFAULT_LIVE_TUNING.readiness.maxSideSeparation,
  },
  /**
   * Live rep windows: the posed-frame index where the rep was triggered. A
   * window can contain more than one detected shot (the player kept moving,
   * so the rep ran to its max duration and swallowed the next shot); only the
   * shot nearest the trigger is the rep — the others are not stored, so one
   * rep never becomes several (duplicate) shots. Omit to keep every shot
   * (e.g. a whole uploaded video).
   */
  focusIndex?: number,
  /**
   * Live rep windows: ms of the rep's pre-roll that has no frames (tracking
   * paused and the recording didn't cover it). A Setup this close to the
   * first frame was pinned there, not found: its checks aren't scored.
   */
  missedStartMs = 0,
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
  const candidates =
    focusIndex === undefined
      ? result.shots
      : nearestShot(result.shots, focusIndex);
  const kept = candidates.filter((a) => {
    const o = a.orientation ?? "unknown";
    if (allowed.includes(o)) return true;
    rejected.push({ reason: "orientation", orientation: o, allowed });
    return false;
  });
  const shots = kept.map((a) => {
    // Real dims only (1×1 is the "unknown" placeholder from PoseData).
    const dims =
      pose.width > 1 && pose.height > 1
        ? { width: pose.width, height: pose.height }
        : {};
    const reviewPoses: ShotReviewPoses = {
      fps: pose.fps,
      ...dims,
      frames: allFrames.slice(
        Math.max(0, a.frameRange.start - POSE_PAD_BEFORE),
        a.frameRange.end + POSE_PAD_AFTER + 1,
      ),
    };
    const analysis: StoredShotAnalysis = {
      ...(a as StoredShotAnalysis),
      keyframes: setupUnseen(
        keyframesForPoses(reviewPoses, opts.shootingHand),
        reviewPoses,
        allFrames[0]?.t,
        missedStartMs,
      ),
    };
    const scorecard = scoreShotKeyframes(analysis.keyframes!, targets);
    return { analysis, scorecard, worst: scorecard.worst, reviewPoses };
  });
  return { shots, rejected };
}

/** Pre-roll missing beyond this (ms) makes an early Setup suspect. */
export const MISSED_START_MIN_MS = 300;
/** A Setup within this (ms) of the first tracked frame is pinned there. */
export const PINNED_SETUP_MS = 500;

/**
 * Setup's checks left unmeasured when the rep's start wasn't tracked and
 * Setup sits at the first tracked frame: the dip began before tracking did.
 */
export function setupUnseen(
  kf: ShotKeyframes,
  poses: ShotReviewPoses,
  firstTs: number | undefined,
  missedStartMs: number,
): ShotKeyframes {
  const setup = kf.keyframes.setup;
  if (missedStartMs < MISSED_START_MIN_MS || setup === null) return kf;
  // Keyframes are source frame indexes (the review frames' frameIndex).
  const t = poses.frames.find((f) => f.frameIndex >= Math.floor(setup))?.t;
  if (t === undefined || firstTs === undefined) return kf;
  if (t - firstTs > PINNED_SETUP_MS) return kf;
  const checks = { ...kf.checks };
  for (const [id, c] of Object.entries(checks))
    if (c.keyframe === "setup")
      checks[id] = {
        ...c,
        value: NaN,
        reliable: false,
        note: "the start of the shot wasn't tracked",
      };
  return { ...kf, checks };
}

/** The shot whose frame range is nearest `index` (inside = distance 0). */
function nearestShot<T extends { frameRange: { start: number; end: number } }>(
  shots: readonly T[],
  index: number,
): T[] {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const s of shots) {
    const { start, end } = s.frameRange;
    const d = index < start ? start - index : index > end ? index - end : 0;
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best ? [best] : [];
}

/**
 * A stored shot's keyframe scorecard against the current targets (scores are
 * recomputed on read, never stored), or null when the shot has no keyframe
 * checks yet (see `ensureKeyframes` to recompute them from the pose track).
 */
export function scorecardForShot(
  analysis: ShotAnalysis,
  targets: KeyframeTargets,
  enabled?: ReadonlySet<string> | null,
): KeyframeScorecard | null {
  return scorecardForStoredShot(analysis, targets, enabled);
}
