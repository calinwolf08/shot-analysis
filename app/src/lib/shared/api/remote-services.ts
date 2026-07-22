/**
 * Remote domain services: the client-facing halves of the domain services that
 * cannot run in the browser (raw-SQL read models, heavy multi-table writes).
 * They implement the same interfaces the app consumes, delegating to the
 * Phase 5 domain endpoints. Read-only services that are pure-over-repo
 * (scoring) are composed from the remote repos instead and live in the
 * composition root.
 *
 * Methods that only ever run server-side (catalog seeding, focus/drill ranking,
 * diagnose-and-persist) throw {@link ServerOnlyError}: reaching them from the
 * client is a wiring bug, not a network failure.
 */
import type { ApiClient } from "./client";
import { ApiError } from "./client";
import type { BenchmarkProfile, MetricName } from "$lib/features/benchmarks";
import type { BenchmarkService } from "$lib/features/benchmarks";
import type { Drill, DrillService } from "$lib/features/drills";
import type { DiagnosisService } from "$lib/features/diagnosis";
import type { FocusAreaRow } from "$lib/features/diagnosis";
import type {
  ProgressService,
  ScoreHistoryPoint,
  MetricTrendPoint,
  ProgressTotals,
} from "$lib/features/progress";
import type {
  Plan,
  PlanItem,
  PlanWithItems,
  TrainingPlanService,
} from "$lib/features/training-plan";

export class ServerOnlyError extends Error {
  constructor(op: string) {
    super(`${op} runs on the server only and is not callable from the client`);
    this.name = "ServerOnlyError";
  }
}

/** Resolves a GET to null when the endpoint 404s (missing/not-found). */
async function getOrNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function createRemoteBenchmarks(api: ApiClient): BenchmarkService {
  return {
    async seed() {
      /* seeded on the server at DB open */
    },
    getActive: () => api.get<BenchmarkProfile>("/api/benchmarks/active"),
    list() {
      throw new ServerOnlyError("BenchmarkService.list");
    },
    get() {
      throw new ServerOnlyError("BenchmarkService.get");
    },
  };
}

export function createRemoteDrills(api: ApiClient): DrillService {
  return {
    async seed() {
      /* seeded on the server at DB open */
    },
    list: () => api.get<Drill[]>("/api/drills"),
    get: (id) => getOrNull(api.get<Drill>(`/api/drills/${id}`)),
    getBySlug: (slug) => getOrNull(api.get<Drill>(`/api/drills/${slug}`)),
    findForFocus() {
      throw new ServerOnlyError("DrillService.findForFocus");
    },
  };
}

export function createRemoteDiagnosis(api: ApiClient): DiagnosisService {
  return {
    diagnoseAndPersist() {
      throw new ServerOnlyError("DiagnosisService.diagnoseAndPersist");
    },
    listForSession: (sessionId) =>
      api.get<FocusAreaRow[]>(
        `/api/diagnosis?sessionId=${encodeURIComponent(sessionId)}`,
      ),
  };
}

export function createRemoteProgress(api: ApiClient): ProgressService {
  const pid = (id: string) => `playerId=${encodeURIComponent(id)}`;
  return {
    scoreHistory: (playerId) =>
      api.get<ScoreHistoryPoint[]>(`/api/progress?${pid(playerId)}&kind=history`),
    metricTrend: (playerId, metric: MetricName) =>
      api.get<MetricTrendPoint[]>(
        `/api/progress?${pid(playerId)}&kind=trend&metric=${encodeURIComponent(metric)}`,
      ),
    totals: (playerId) =>
      api.get<ProgressTotals>(`/api/progress?${pid(playerId)}&kind=totals`),
  };
}

export function createRemoteTrainingPlan(api: ApiClient): TrainingPlanService {
  const pid = (id: string) => `playerId=${encodeURIComponent(id)}`;
  return {
    generateForSession: (sessionId, playerId) =>
      api.send<Plan>("/api/plans", { sessionId, playerId }),
    completeReassessment: (sessionId, playerId, planItemId) =>
      api.send<Plan>("/api/plans/reassess", {
        sessionId,
        playerId,
        planItemId,
      }),
    getPlan: (planId) => getOrNull(api.get<PlanWithItems>(`/api/plans/${planId}`)),
    getActivePlan: (playerId) =>
      api.get<PlanWithItems | null>(`/api/plans?${pid(playerId)}`),
    getItem: (itemId) => getOrNull(api.get<PlanItem>(`/api/plans/items/${itemId}`)),
    async completeItem(itemId) {
      await api.send(`/api/plans/items/${itemId}`, {}, "PATCH");
    },
    nextPendingItem: (playerId) =>
      api.get<{ plan: Plan; item: PlanItem } | null>(
        `/api/plans?${pid(playerId)}&kind=next-pending`,
      ),
  };
}
