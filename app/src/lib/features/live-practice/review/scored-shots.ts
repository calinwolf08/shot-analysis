/**
 * Read path for stored shots: each shot's keyframe scorecard against the
 * current targets and the player's feedback filter (scores are derived on
 * read, never stored).
 *
 * Read-time migration: a shot stored before the keyframe checks (or before
 * v3) has them recomputed from its stored review pose track — exactly as live
 * computes them — and persisted, so this happens once per shot. A shot with
 * no pose track can't be re-analyzed: its scorecard is null ("Re-analysis
 * unavailable") and it's left out of trends.
 *
 * The v3 scorecard is still produced for the review screen until it moves to
 * the keyframe checks (docs/keyframe-review-plan.md, phase 3).
 */
import type { KeyframeTargets, LiveTargetsV3 } from "basketball-shot-analysis";
import type {
  ShotRecord,
  ShotRepo,
  ShotReviewPoses,
} from "$lib/shared/db/repos";
import {
  ensureV3,
  hasV3,
  scorecardV3ForShot,
  type ScorecardV3,
} from "$lib/features/scoring/v3";
import {
  ensureKeyframes,
  hasKeyframes,
  scorecardForStoredShot,
  type KeyframeScorecard,
} from "$lib/features/scoring/keyframes";
import type { StoredShotAnalysis } from "$lib/features/analysis/replay/replay-pipeline";

export interface ScoredShotRecord {
  readonly record: ShotRecord;
  /** Null when the shot has no keyframe checks and no pose track to compute them. */
  readonly card: KeyframeScorecard | null;
}

type Repo = Pick<ShotRepo, "getPoses" | "updateAnalysis">;

/**
 * The shot's analysis with current keyframe checks AND v3 metrics, migrating
 * (and persisting) from the pose track when either is missing or outdated.
 */
async function migrated(
  repo: Repo,
  record: ShotRecord,
  shootingHand: "left" | "right",
  poses?: ShotReviewPoses | null,
): Promise<ShotRecord> {
  if (hasKeyframes(record.analysis) && hasV3(record.analysis)) return record;
  const track =
    poses !== undefined
      ? poses
      : await repo.getPoses(record.id).catch(() => null);
  let analysis = record.analysis as StoredShotAnalysis;
  let changed = false;
  const k = ensureKeyframes(analysis, track, shootingHand);
  if (k) {
    analysis = k.analysis;
    changed ||= k.recomputed;
  }
  const v = ensureV3(analysis, track, shootingHand);
  if (v) {
    analysis = v.analysis;
    changed ||= v.recomputed;
  }
  if (changed) {
    // Best effort: a failed write just means we recompute next time.
    await repo.updateAnalysis(record.id, analysis).catch(() => {});
  }
  return { ...record, analysis };
}

/** One shot, migrating it if needed (`poses` when the caller already has them). */
export async function scoreStoredShot(
  repo: Repo,
  record: ShotRecord,
  shootingHand: "left" | "right",
  targets: KeyframeTargets,
  poses?: ShotReviewPoses | null,
  enabled?: ReadonlySet<string> | null,
): Promise<ScoredShotRecord> {
  const next = await migrated(repo, record, shootingHand, poses);
  return {
    record: next,
    card: scorecardForStoredShot(next.analysis, targets, enabled),
  };
}

/** Many shots (order preserved). */
export function scoreStoredShots(
  repo: Repo,
  records: readonly ShotRecord[],
  shootingHand: "left" | "right",
  targets: KeyframeTargets,
  enabled?: ReadonlySet<string> | null,
): Promise<ScoredShotRecord[]> {
  return Promise.all(
    records.map((r) =>
      scoreStoredShot(repo, r, shootingHand, targets, undefined, enabled),
    ),
  );
}

/**
 * The review screen's v3 scorecard (until it moves to the keyframe checks),
 * migrating the shot the same way.
 */
export async function scoreStoredShotV3(
  repo: Repo,
  record: ShotRecord,
  shootingHand: "left" | "right",
  targets: LiveTargetsV3,
  poses?: ShotReviewPoses | null,
): Promise<{ record: ShotRecord; card: ScorecardV3 | null }> {
  const next = await migrated(repo, record, shootingHand, poses);
  return { record: next, card: scorecardV3ForShot(next.analysis, targets) };
}
