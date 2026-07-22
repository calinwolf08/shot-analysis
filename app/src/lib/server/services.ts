/**
 * Server-side domain composition.
 *
 * `createServerDomain(db, userId)` builds the same domain services the client
 * used to run locally, but over the single server database and the user-scoped
 * {@link createServerRepos}. The 7 user-owned repos enforce ownership on every
 * read/write; the feature-local repos the services reach into (benchmarks,
 * drills, focus areas, plans) are either **global** (benchmarks, drills — the
 * same catalog for everyone) or keyed by a `sessionId`/`playerId` whose
 * ownership the calling **endpoint** verifies first via the scoped repos.
 *
 * `assessment` is intentionally omitted here: it needs an
 * {@link AnalysisService}, which the server gains in Phase 6.
 *
 * Server-only.
 */
import type { DatabaseAdapter } from "$lib/shared/db";
import type { RepoContext } from "$lib/shared/db/repo-base";
import { systemClock, uuidIdGenerator } from "$lib/shared/utils";
import { createDrillService } from "$lib/features/drills";
import { createBenchmarkService } from "$lib/features/benchmarks";
import { createDiagnosisService } from "$lib/features/diagnosis";
import { createScoringService } from "$lib/features/scoring";
import { createTrainingPlanService } from "$lib/features/training-plan";
import { createProgressService } from "$lib/features/progress";
import { createServerRepos } from "./repos";

/** The domain services available on the server (assessment lands in Phase 6). */
export interface ServerDomain {
  benchmarks: ReturnType<typeof createBenchmarkService>;
  scoring: ReturnType<typeof createScoringService>;
  diagnosis: ReturnType<typeof createDiagnosisService>;
  drills: ReturnType<typeof createDrillService>;
  trainingPlan: ReturnType<typeof createTrainingPlanService>;
  progress: ReturnType<typeof createProgressService>;
}

/**
 * Composes the domain services over the server DB, scoped to `userId`.
 * Cheap to build per request: the services are thin factories over the shared
 * DB handle.
 */
export function createServerDomain(
  db: DatabaseAdapter,
  userId: string,
): ServerDomain {
  const ctx: RepoContext = { db, clock: systemClock, ids: uuidIdGenerator };
  const repos = createServerRepos(db, userId);

  const benchmarks = createBenchmarkService(ctx, { settings: repos.settings });
  const scoring = createScoringService(ctx, {
    shotRepo: repos.shot,
    scoreRepo: repos.score,
  });
  const diagnosis = createDiagnosisService(ctx);
  const drills = createDrillService(ctx);
  const trainingPlan = createTrainingPlanService(ctx, {
    drills,
    players: repos.player,
  });
  const progress = createProgressService(ctx);

  return { benchmarks, scoring, diagnosis, drills, trainingPlan, progress };
}

/**
 * Seeds the global catalogs (benchmarks + drills) idempotently. Called once
 * after migrations when the DB is opened, so every request sees the built-in
 * data regardless of which user connects first. Uses a throwaway system user id
 * because the catalogs are not user-scoped.
 */
export async function seedGlobals(db: DatabaseAdapter): Promise<void> {
  const ctx: RepoContext = { db, clock: systemClock, ids: uuidIdGenerator };
  const benchmarks = createBenchmarkService(ctx, {
    // The settings repo is only read by getActive(); seed() never touches it.
    settings: createServerRepos(db, "system").settings,
  });
  const drills = createDrillService(ctx);
  await benchmarks.seed();
  await drills.seed();
}
