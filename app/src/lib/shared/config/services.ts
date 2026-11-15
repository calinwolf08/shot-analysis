/**
 * AppServices — the composition root. Built once at startup in
 * +layout.svelte, injected everywhere via Svelte context; tests build a
 * fake container with createTestServices() (see test-services.ts).
 *
 * Grows as features land (analysis, scoring, benchmarks, …).
 */
import {
  createFetchFixtureLoader,
  createReplayAnalysisService,
  type AnalysisService,
} from "$lib/features/analysis";
import { createWorkerAnalysisService } from "$lib/features/analysis/services/worker-analysis-service";
import {
  createAssessmentService,
  type AssessmentService,
} from "$lib/features/assessment";
import {
  createBenchmarkService,
  type BenchmarkService,
} from "$lib/features/benchmarks";
import {
  createDiagnosisService,
  type DiagnosisService,
} from "$lib/features/diagnosis";
import { createDrillService, type DrillService } from "$lib/features/drills";
import {
  createProgressService,
  type ProgressService,
} from "$lib/features/progress";
import {
  createTrainingPlanService,
  type TrainingPlanService,
} from "$lib/features/training-plan";
import {
  createScoringService,
  type ScoringService,
} from "$lib/features/scoring";
import type { DatabaseAdapter } from "../db";
import type { RepoContext } from "../db/repo-base";
import {
  createPlayerRepo,
  createRepRepo,
  createScoreRepo,
  createSessionRepo,
  createSettingsRepo,
  createShotRepo,
  createVideoRepo,
  type PlayerRepo,
  type RepRepo,
  type ScoreRepo,
  type SessionRepo,
  type SettingsRepo,
  type ShotRepo,
  type VideoRepo,
} from "../db/repos";
import type { Clock, IdGenerator } from "../utils";
import { systemClock, uuidIdGenerator } from "../utils";
import { createApiClient } from "../api/client";
import { createRemoteRepos } from "../api/remote-repos";
import {
  createRemoteBenchmarks,
  createRemoteDiagnosis,
  createRemoteDrills,
  createRemoteProgress,
  createRemoteTrainingPlan,
} from "../api/remote-services";
import { createServerAssessmentService } from "$lib/features/assessment/services/server-assessment-service";

export interface AppRepos {
  player: PlayerRepo;
  video: VideoRepo;
  session: SessionRepo;
  shot: ShotRepo;
  score: ScoreRepo;
  rep: RepRepo;
  settings: SettingsRepo;
}

export interface AppServices extends RepoContext {
  db: DatabaseAdapter;
  clock: Clock;
  ids: IdGenerator;
  repos: AppRepos;
  analysis: AnalysisService;
  benchmarks: BenchmarkService;
  scoring: ScoringService;
  diagnosis: DiagnosisService;
  assessment: AssessmentService;
  drills: DrillService;
  trainingPlan: TrainingPlanService;
  progress: ProgressService;
}

/** Composes the domain services over a base context (shared with tests). */
export function createDomainServices(
  ctx: RepoContext,
  repos: AppRepos,
  analysis: AnalysisService,
): Pick<
  AppServices,
  | "benchmarks"
  | "scoring"
  | "diagnosis"
  | "assessment"
  | "drills"
  | "trainingPlan"
  | "progress"
> {
  const benchmarks = createBenchmarkService(ctx, { settings: repos.settings });
  const scoring = createScoringService(ctx, {
    shotRepo: repos.shot,
    scoreRepo: repos.score,
  });
  const diagnosis = createDiagnosisService(ctx);
  const assessment = createAssessmentService({
    db: ctx.db,
    repos,
    analysis,
    scoring,
    diagnosis,
    benchmarks,
  });
  const drills = createDrillService(ctx);
  const trainingPlan = createTrainingPlanService(ctx, {
    drills,
    players: repos.player,
  });
  const progress = createProgressService(ctx);
  return {
    benchmarks,
    scoring,
    diagnosis,
    assessment,
    drills,
    trainingPlan,
    progress,
  };
}

/** Builds the shared repo set from a RepoContext. */
export function createRepos(ctx: RepoContext): AppRepos {
  return {
    player: createPlayerRepo(ctx),
    video: createVideoRepo(ctx),
    session: createSessionRepo(ctx),
    shot: createShotRepo(ctx),
    score: createScoreRepo(ctx),
    rep: createRepRepo(ctx),
    settings: createSettingsRepo(ctx),
  };
}

/**
 * Analysis backend selection: the deterministic replay backend is used when
 * the page is loaded with ?e2e=replay (test builds) or the app is built
 * with VITE_ANALYSIS_BACKEND=replay; otherwise the real MediaPipe worker.
 */
export function selectAnalysisService(): AnalysisService {
  const replayRequested =
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("e2e") === "replay") ||
    import.meta.env.VITE_ANALYSIS_BACKEND === "replay";
  if (replayRequested) {
    return createReplayAnalysisService({
      loadFixture: createFetchFixtureLoader(),
      liveFixtureId: "20201212_134104",
      liveSpeed: 4,
      liveLoop: true, // live mode behaves like a camera that never stops
    });
  }
  return createWorkerAnalysisService();
}

/**
 * The client no longer owns a database — all user data lives on the server.
 * This stub satisfies the {@link DatabaseAdapter} shape for the few call sites
 * that still reference `services.db` (e.g. `flushDb`, which becomes a no-op
 * because there is nothing to persist locally). Any actual query/run is a bug.
 */
function createNoClientDb(): DatabaseAdapter {
  const fail = (): never => {
    throw new Error(
      "No client database: user data lives on the server — use the API/remote repos",
    );
  };
  return {
    run: async () => fail(),
    query: async () => fail(),
    transaction: async () => fail(),
    close: async () => {},
    // No `flush` → flushDb() is a no-op.
  };
}

/**
 * Production composition (client): a remote data layer over the SvelteKit API.
 * The on-device database is gone — repos and read-model services call the
 * server (user-scoped by the bearer token), scoring runs over the remote repos,
 * and analysis is performed server-side (client extracts poses only). See
 * docs/server-migration-plan.md Phases 5–7.
 */
export async function createAppServices(): Promise<AppServices> {
  const api = createApiClient();
  const ctx: RepoContext = {
    db: createNoClientDb(),
    clock: systemClock,
    ids: uuidIdGenerator,
  };
  const repos = createRemoteRepos(api);
  const analysis = selectAnalysisService();

  const benchmarks = createRemoteBenchmarks(api);
  const scoring = createScoringService(ctx, {
    shotRepo: repos.shot,
    scoreRepo: repos.score,
  });
  const diagnosis = createRemoteDiagnosis(api);
  const drills = createRemoteDrills(api);
  const trainingPlan = createRemoteTrainingPlan(api);
  const progress = createRemoteProgress(api);
  const assessment = createServerAssessmentService({ analysis, repos, api });

  return {
    ...ctx,
    repos,
    analysis,
    benchmarks,
    scoring,
    diagnosis,
    assessment,
    drills,
    trainingPlan,
    progress,
  };
}
