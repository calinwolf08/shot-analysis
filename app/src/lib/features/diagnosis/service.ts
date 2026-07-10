import type { BenchmarkProfile } from "$lib/features/benchmarks";
import type { RepScore, SessionScore } from "$lib/features/scoring";
import type { RepoContext } from "$lib/shared/db/repo-base";
import { diagnose, type DiagnosisWeights, type FocusArea } from "./engine";
import {
  createFocusAreaRepo,
  type FocusAreaRepo,
  type FocusAreaRow,
} from "./repo/focus-area-repo";

export interface DiagnosisService {
  /** Diagnoses a scored session and persists the ranked focus areas. */
  diagnoseAndPersist(
    sessionId: string,
    sessionScore: SessionScore,
    repScores: readonly RepScore[],
    benchmark: BenchmarkProfile,
  ): Promise<FocusArea[]>;
  listForSession(sessionId: string): Promise<FocusAreaRow[]>;
}

export interface DiagnosisServiceDeps {
  repo?: FocusAreaRepo;
  weights?: DiagnosisWeights;
}

export function createDiagnosisService(
  ctx: RepoContext,
  deps: DiagnosisServiceDeps = {},
): DiagnosisService {
  const repo = deps.repo ?? createFocusAreaRepo(ctx);
  return {
    async diagnoseAndPersist(sessionId, sessionScore, repScores, benchmark) {
      const areas = diagnose(sessionScore, repScores, benchmark, deps.weights);
      await repo.replaceForSession(
        sessionId,
        areas.map((area) => ({
          rank: area.rank,
          issueGroup: area.issueGroup,
          severity: area.severity,
          metrics: {
            displayName: area.displayName,
            whyItMatters: area.whyItMatters,
            surfaced: area.surfaced,
            metrics: area.metrics,
          },
        })),
      );
      return areas;
    },
    listForSession: (sessionId) => repo.listBySession(sessionId),
  };
}
