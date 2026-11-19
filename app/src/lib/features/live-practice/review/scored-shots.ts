/**
 * Read path for stored shots: each shot's v3 scorecard against the current
 * targets (scores are derived on read, never stored).
 *
 * Read-time migration: a shot analyzed before v3 (metrics schema 1) has its
 * v3 metrics recomputed from its stored review pose track — exactly as live
 * computes them — and persisted, so this happens once per shot. A shot with
 * no pose track can't be re-analyzed: its scorecard is null ("Re-analysis
 * unavailable") and it's left out of trends.
 */
import type { LiveTargetsV3 } from "basketball-shot-analysis";
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

export interface ScoredShotRecord {
  readonly record: ShotRecord;
  /** Null when the shot has no v3 metrics and no pose track to compute them. */
  readonly card: ScorecardV3 | null;
}

type Repo = Pick<ShotRepo, "getPoses" | "updateAnalysis">;

/** One shot, migrating it if needed (`poses` when the caller already has them). */
export async function scoreStoredShot(
  repo: Repo,
  record: ShotRecord,
  shootingHand: "left" | "right",
  targets: LiveTargetsV3,
  poses?: ShotReviewPoses | null,
): Promise<ScoredShotRecord> {
  if (hasV3(record.analysis)) {
    return { record, card: scorecardV3ForShot(record.analysis, targets) };
  }
  const track =
    poses !== undefined
      ? poses
      : await repo.getPoses(record.id).catch(() => null);
  const migrated = ensureV3(record.analysis, track, shootingHand);
  if (!migrated) return { record, card: null };
  if (migrated.recomputed) {
    // Best effort: a failed write just means we recompute next time.
    await repo.updateAnalysis(record.id, migrated.analysis).catch(() => {});
  }
  const next = { ...record, analysis: migrated.analysis };
  return { record: next, card: scorecardV3ForShot(next.analysis, targets) };
}

/** Many shots (order preserved). */
export function scoreStoredShots(
  repo: Repo,
  records: readonly ShotRecord[],
  shootingHand: "left" | "right",
  targets: LiveTargetsV3,
): Promise<ScoredShotRecord[]> {
  return Promise.all(
    records.map((r) => scoreStoredShot(repo, r, shootingHand, targets)),
  );
}
