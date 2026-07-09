/**
 * AssessmentService — the full upload→analyze→score→diagnose pipeline.
 * Everything is persisted as it happens; cancellation aborts the session
 * row (kept for history, never scored).
 */
import type {
  AnalysisInput,
  AnalysisProgress,
  AnalysisService,
} from "$lib/features/analysis";
import type { BenchmarkService } from "$lib/features/benchmarks";
import type { DiagnosisService, FocusArea } from "$lib/features/diagnosis";
import type { ScoringService, SessionScore } from "$lib/features/scoring";
import type { AppRepos } from "$lib/shared/config/services";
import { flushDb } from "$lib/shared/db";
import type { DatabaseAdapter } from "$lib/shared/db";
import type { PlayerLevel, ShotRecord } from "$lib/shared/db/repos";

export interface AssessmentVideoInput {
  input: AnalysisInput;
  /** Display name (file name or fixture id). */
  name: string;
  durationMs?: number;
  fps?: number;
}

export interface AssessmentProgress {
  videoIndex: number;
  videoCount: number;
  videoName: string;
  analysis: AnalysisProgress | null;
  totalShotsDetected: number;
}

export interface AssessmentOutcome {
  sessionId: string;
  shots: ShotRecord[];
  sessionScore: SessionScore;
  focusAreas: FocusArea[];
}

export class AssessmentAbortedError extends Error {
  constructor(public readonly sessionId: string) {
    super("Assessment aborted");
    this.name = "AssessmentAbortedError";
  }
}

export class NoShotsDetectedError extends Error {
  constructor(public readonly sessionId: string) {
    super(
      "No shots were detected in the provided videos. Check camera placement and try again.",
    );
    this.name = "NoShotsDetectedError";
  }
}

/** Library form profile per player level. */
export function profileForLevel(level: PlayerLevel): string {
  switch (level) {
    case "youth":
      return "youth-fundamentals";
    case "high-school":
      return "high-school";
    case "advanced":
      return "pro-form";
  }
}

export interface AssessmentService {
  runAssessment(
    inputs: AssessmentVideoInput[],
    opts?: {
      signal?: AbortSignal;
      onProgress?: (p: AssessmentProgress) => void;
    },
  ): Promise<AssessmentOutcome>;
  /** Re-score + re-diagnose after review exclusions changed. */
  rescoreSession(sessionId: string): Promise<AssessmentOutcome>;
  setShotExcluded(shotId: string, excluded: boolean): Promise<void>;
}

export interface AssessmentServiceDeps {
  db: DatabaseAdapter;
  repos: AppRepos;
  analysis: AnalysisService;
  scoring: ScoringService;
  diagnosis: DiagnosisService;
  benchmarks: BenchmarkService;
}

export function createAssessmentService(
  deps: AssessmentServiceDeps,
): AssessmentService {
  const { repos } = deps;

  async function scoreAndDiagnose(
    sessionId: string,
  ): Promise<AssessmentOutcome> {
    const benchmark = await deps.benchmarks.getActive();
    const { session, shots } = await deps.scoring.scoreAndPersistSession(
      sessionId,
      benchmark,
    );
    const focusAreas = await deps.diagnosis.diagnoseAndPersist(
      sessionId,
      session,
      shots.map((s) => s.repScore),
      benchmark,
    );
    return {
      sessionId,
      shots: shots.map((s) => s.shot),
      sessionScore: session,
      focusAreas,
    };
  }

  return {
    async runAssessment(inputs, opts = {}) {
      const player = await repos.player.getFirst();
      if (!player) throw new Error("No player profile — onboarding required");
      const session = await repos.session.create({
        playerId: player.id,
        type: "assessment",
      });

      const emit = opts.onProgress ?? (() => undefined);
      let totalShots = 0;

      try {
        for (let i = 0; i < inputs.length; i++) {
          const item = inputs[i]!;
          throwIfAborted(opts.signal, session.id);
          emit({
            videoIndex: i,
            videoCount: inputs.length,
            videoName: item.name,
            analysis: null,
            totalShotsDetected: totalShots,
          });

          const video = await repos.video.create({
            playerId: player.id,
            source: "upload",
            ...(item.durationMs !== undefined
              ? { durationMs: item.durationMs }
              : {}),
            ...(item.fps !== undefined ? { fps: item.fps } : {}),
          });

          const result = await deps.analysis.analyzeVideoFile(
            item.input,
            {
              shootingHand: player.shootingHand,
              profile: profileForLevel(player.level),
              ...(opts.signal ? { signal: opts.signal } : {}),
            },
            (p) =>
              emit({
                videoIndex: i,
                videoCount: inputs.length,
                videoName: item.name,
                analysis: p,
                totalShotsDetected: totalShots + p.shotsDetected,
              }),
          );

          for (const analysis of result.shots) {
            throwIfAborted(opts.signal, session.id);
            await repos.shot.saveAnalysis({
              sessionId: session.id,
              videoId: video.id,
              analysis,
            });
          }
          totalShots += result.shots.length;
        }

        if (totalShots === 0) {
          await repos.session.abort(session.id);
          throw new NoShotsDetectedError(session.id);
        }

        throwIfAborted(opts.signal, session.id);
        const outcome = await scoreAndDiagnose(session.id);
        await repos.session.complete(session.id);
        await flushDb(deps.db);
        return outcome;
      } catch (err) {
        if (isAbort(err, opts.signal)) {
          await repos.session.abort(session.id);
          await flushDb(deps.db);
          throw new AssessmentAbortedError(session.id);
        }
        if (!(err instanceof NoShotsDetectedError)) {
          await repos.session.abort(session.id);
        }
        throw err;
      }
    },

    async rescoreSession(sessionId) {
      const outcome = await scoreAndDiagnose(sessionId);
      await flushDb(deps.db);
      return outcome;
    },

    setShotExcluded: (shotId, excluded) =>
      repos.shot.setExcluded(shotId, excluded),
  };
}

function throwIfAborted(signal: AbortSignal | undefined, sessionId: string) {
  if (signal?.aborted) throw new AssessmentAbortedError(sessionId);
}

function isAbort(err: unknown, signal?: AbortSignal): boolean {
  return err instanceof AssessmentAbortedError || (signal?.aborted ?? false);
}
