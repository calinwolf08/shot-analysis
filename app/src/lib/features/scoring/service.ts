/**
 * ScoringService — scores shots/sessions against the active benchmark and
 * persists versioned score rows (history preserved across re-scores).
 */
import type { BenchmarkProfile, MetricName } from "$lib/features/benchmarks";
import type { RepoContext } from "$lib/shared/db/repo-base";
import type { ScoreRepo, ShotRecord, ShotRepo } from "$lib/shared/db/repos";
import { selectCues } from "./cues";
import { scoreRep } from "./engine";
import { scoreSession, type SessionScore } from "./session";
import type { CueSelection, RepScore, ScoringConfig } from "./types";

export interface ScoredShot {
  shot: ShotRecord;
  repScore: RepScore;
  cues: CueSelection;
}

export interface ScoringService {
  /** Scores one persisted shot and writes a shot-scope score row. */
  scoreAndPersistShot(
    shot: ShotRecord,
    benchmark: BenchmarkProfile,
    focusMetric?: MetricName,
  ): Promise<ScoredShot>;
  /**
   * Scores all included shots of a session (rep rows + session row).
   * Returns the session score with per-shot results.
   */
  scoreAndPersistSession(
    sessionId: string,
    benchmark: BenchmarkProfile,
  ): Promise<{ session: SessionScore; shots: ScoredShot[] }>;
  /** Pure re-score of a session without persistence (previews). */
  computeSessionScore(
    shots: ShotRecord[],
    benchmark: BenchmarkProfile,
  ): { session: SessionScore; reps: RepScore[] };
}

export interface ScoringServiceDeps {
  shotRepo: ShotRepo;
  scoreRepo: ScoreRepo;
  config?: ScoringConfig;
}

export function createScoringService(
  _ctx: RepoContext,
  deps: ScoringServiceDeps,
): ScoringService {
  const { shotRepo, scoreRepo } = deps;

  function scoreOne(
    shot: ShotRecord,
    benchmark: BenchmarkProfile,
    focusMetric?: MetricName,
  ): ScoredShot {
    const repScore = scoreRep(shot.analysis, benchmark, deps.config);
    const cues = selectCues(repScore, benchmark, focusMetric);
    return { shot, repScore, cues };
  }

  return {
    async scoreAndPersistShot(shot, benchmark, focusMetric) {
      const scored = scoreOne(shot, benchmark, focusMetric);
      await scoreRepo.insert({
        scope: "shot",
        refId: shot.id,
        benchmarkId: benchmark.id,
        scoringVersion: scored.repScore.scoringVersion,
        formScore: scored.repScore.formScore,
        breakdown: scored.repScore,
      });
      return scored;
    },

    computeSessionScore(shots, benchmark) {
      const reps = shots.map((s) =>
        scoreRep(s.analysis, benchmark, deps.config),
      );
      const session = scoreSession(
        reps,
        shots.map((s) => s.analysis),
        benchmark,
        deps.config ? { config: deps.config } : {},
      );
      return { session, reps };
    },

    async scoreAndPersistSession(sessionId, benchmark) {
      const shots = await shotRepo.listBySession(sessionId);
      const scoredShots: ScoredShot[] = [];
      for (const shot of shots) {
        const scored = scoreOne(shot, benchmark);
        scoredShots.push(scored);
        await scoreRepo.insert({
          scope: "shot",
          refId: shot.id,
          benchmarkId: benchmark.id,
          scoringVersion: scored.repScore.scoringVersion,
          formScore: scored.repScore.formScore,
          breakdown: scored.repScore,
        });
      }

      const session = scoreSession(
        scoredShots.map((s) => s.repScore),
        shots.map((s) => s.analysis),
        benchmark,
        deps.config ? { config: deps.config } : {},
      );
      await scoreRepo.insert({
        scope: "session",
        refId: sessionId,
        benchmarkId: benchmark.id,
        scoringVersion: session.scoringVersion,
        formScore: session.form,
        consistencyScore: session.consistency,
        efficiencyScore: session.efficiency,
        overallScore: session.overall,
        breakdown: session.breakdown,
      });
      return { session, shots: scoredShots };
    },
  };
}
