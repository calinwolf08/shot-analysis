/**
 * ShotStore — the narrow persistence port the live pipeline depends on.
 *
 * The pipeline only needs to persist an analyzed shot rooted on the player; it
 * does not need the whole repo surface. Backing it with either the server repos
 * (SQLite) or the remote repos (HTTP) is what makes on-device vs server analysis
 * swap cleanly — the compute location changes, the persistence seam doesn't.
 *
 * (Raw per-shot pose-frame persistence for scrub review is added in step 7,
 * where the review UI consumes it; the port gains a `poseData` field then.)
 *
 * @see docs/live-redesign-plan.md §3.5
 */
import type { StoredShotAnalysis } from "$lib/features/analysis";
import type { ShotRecord, ShotRepo } from "$lib/shared/db/repos";

export interface SaveShotInput {
  readonly playerId: string;
  readonly analysis: StoredShotAnalysis;
}

export interface ShotStore {
  save(input: SaveShotInput): Promise<ShotRecord>;
}

/** A ShotStore backed by a (server or remote) ShotRepo. */
export function createRepoShotStore(shotRepo: ShotRepo): ShotStore {
  return {
    save: ({ playerId, analysis }) =>
      shotRepo.saveAnalysis({ playerId, analysis }),
  };
}
