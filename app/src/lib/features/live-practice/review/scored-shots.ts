/**
 * Read path for stored shots: each shot's keyframe scorecard against the
 * current targets and the player's feedback filter (scores are derived on
 * read, never stored).
 *
 * Read-time migration: a shot stored before the keyframe checks (or with an
 * older definition) has them recomputed from its stored review pose track —
 * exactly as live computes them — and persisted, so this happens once per
 * shot. A shot with no pose track can't be re-analyzed: its scorecard is null
 * ("Re-analysis unavailable") and it's left out of trends.
 */
import type { KeyframeTargets } from "basketball-shot-analysis";
import type {
  ShotRecord,
  ShotRepo,
  ShotReviewPoses,
} from "$lib/shared/db/repos";
import {
  ensureKeyframes,
  hasKeyframes,
  scorecardForStoredShot,
  type KeyframeScorecard,
} from "$lib/features/scoring/keyframes";

export interface ScoredShotRecord {
  readonly record: ShotRecord;
  /** Null when the shot has no keyframe checks and no pose track to compute them. */
  readonly card: KeyframeScorecard | null;
}

type Repo = Pick<ShotRepo, "getPoses" | "updateAnalysis">;

/** The shot with current keyframe checks (recomputed + persisted if needed). */
async function migrated(
  repo: Repo,
  record: ShotRecord,
  shootingHand: "left" | "right",
  poses?: ShotReviewPoses | null,
): Promise<ShotRecord> {
  if (hasKeyframes(record.analysis)) return record;
  const track =
    poses !== undefined
      ? poses
      : await repo.getPoses(record.id).catch(() => null);
  const k = ensureKeyframes(record.analysis, track, shootingHand);
  if (!k) return record;
  if (k.recomputed) {
    // Best effort: a failed write just means we recompute next time.
    await repo.updateAnalysis(record.id, k.analysis).catch(() => {});
  }
  return { ...record, analysis: k.analysis };
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
