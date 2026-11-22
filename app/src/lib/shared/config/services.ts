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
import { parsePositioningScript } from "$lib/features/analysis/replay/positioning-script";
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
import { noDatabase, type RepoContext } from "../db/repo-base";
import type {
  PlayerRepo,
  RepRepo,
  ScoreRepo,
  SessionRepo,
  SettingsRepo,
  ShotRepo,
  VideoRepo,
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
    // Test-only knobs (replay is itself a test backend):
    //   replayFixture=<id>     which pose fixture the live stream replays
    //   replaySpeed=<n>        fixture playback multiplier (default 4)
    //   replayLatencyMs=<ms>   simulated detection latency per frame
    //   replayScript=<spec>    scripted positioning before the fixture
    //                          (see replay/positioning-script.ts)
    const q =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const num = (key: string, fallback: number) => {
      const v = Number(q.get(key));
      return q.has(key) && Number.isFinite(v) && v > 0 ? v : fallback;
    };
    return createReplayAnalysisService({
      loadFixture: createFetchFixtureLoader(),
      liveFixtureId: q.get("replayFixture") ?? "20201212_134104",
      liveSpeed: num("replaySpeed", 4),
      liveLoop: true, // live mode behaves like a camera that never stops
      liveLatencyMs: num("replayLatencyMs", 0),
      liveScript: parsePositioningScript(q.get("replayScript")),
    });
  }
  return createWorkerAnalysisService();
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
    kdb: noDatabase("the browser (all data goes through the API)"),
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
