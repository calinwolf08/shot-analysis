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
  createScoringService,
  type ScoringService,
} from "$lib/features/scoring";
import type { DatabaseAdapter } from "../db";
import { createDatabase, migrate } from "../db";
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
import { getPlatform } from "./platform";

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
}

/** Composes the domain services over a base context (shared with tests). */
export function createDomainServices(
  ctx: RepoContext,
  repos: AppRepos,
  analysis: AnalysisService,
): Pick<
  AppServices,
  "benchmarks" | "scoring" | "diagnosis" | "assessment" | "drills"
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
  return { benchmarks, scoring, diagnosis, assessment, drills };
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
    });
  }
  return createWorkerAnalysisService();
}

/** Production composition: platform DB, migrations + benchmark seed applied. */
export async function createAppServices(): Promise<AppServices> {
  const db = await createDatabase(getPlatform());
  await migrate(db);
  const ctx: RepoContext = {
    db,
    clock: systemClock,
    ids: uuidIdGenerator,
  };
  const repos = createRepos(ctx);
  const analysis = selectAnalysisService();
  const domain = createDomainServices(ctx, repos, analysis);
  await domain.benchmarks.seed();
  await domain.drills.seed();
  return {
    ...ctx,
    repos,
    analysis,
    ...domain,
  };
}
