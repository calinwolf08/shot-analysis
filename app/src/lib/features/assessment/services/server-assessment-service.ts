/**
 * Server-backed AssessmentService (production).
 *
 * Pose extraction stays on the client (MediaPipe worker / replay), but the
 * authoritative full analysis, scoring, diagnosis, and persistence happen on
 * the server: the browser extracts pose frames per video and POSTs them to
 * `/api/analysis/session`. Review exclusions re-score via
 * `/api/sessions/:id/rescore`. Same interface the assessment store already
 * drives — see docs/server-migration-plan.md Phase 7.1.
 */
import type { AnalysisService } from "$lib/features/analysis";
import type { ApiClient } from "$lib/shared/api/client";
import type { AppRepos } from "$lib/shared/config/services";
import {
  AssessmentAbortedError,
  NoShotsDetectedError,
  profileForLevel,
  type AssessmentOutcome,
  type AssessmentService,
} from "./assessment-service";

export interface ServerAssessmentServiceDeps {
  analysis: AnalysisService;
  repos: AppRepos;
  api: ApiClient;
}

type SessionResponse = AssessmentOutcome | { sessionId: string; noShots: true };

export function createServerAssessmentService(
  deps: ServerAssessmentServiceDeps,
): AssessmentService {
  const { analysis, repos, api } = deps;

  return {
    async runAssessment(inputs, opts = {}) {
      const player = await repos.player.getFirst();
      if (!player) throw new Error("No player profile — onboarding required");
      const analyzeOpts = {
        shootingHand: player.shootingHand,
        profile: profileForLevel(player.level),
        ...(opts.signal ? { signal: opts.signal } : {}),
      };
      const emit = opts.onProgress ?? (() => undefined);

      const bail = () => {
        if (opts.signal?.aborted) throw new AssessmentAbortedError("");
      };

      const videos: { poseData: unknown; durationMs?: number; fps?: number }[] =
        [];
      try {
        for (let i = 0; i < inputs.length; i++) {
          const item = inputs[i]!;
          bail();
          emit({
            videoIndex: i,
            videoCount: inputs.length,
            videoName: item.name,
            analysis: null,
            totalShotsDetected: videos.length,
          });
          const poseData = await analysis.extractPoses(
            item.input,
            analyzeOpts,
            (p) =>
              emit({
                videoIndex: i,
                videoCount: inputs.length,
                videoName: item.name,
                analysis: p,
                totalShotsDetected: videos.length,
              }),
          );
          videos.push({
            poseData,
            ...(item.durationMs !== undefined
              ? { durationMs: item.durationMs }
              : {}),
            ...(item.fps !== undefined ? { fps: item.fps } : {}),
          });
        }
      } catch (err) {
        if (opts.signal?.aborted) throw new AssessmentAbortedError("");
        throw err;
      }

      bail();
      const res = await api.send<SessionResponse>("/api/analysis/session", {
        playerId: player.id,
        videos,
        ...(opts.planItemId ? { planItemId: opts.planItemId } : {}),
      });
      if ("noShots" in res) throw new NoShotsDetectedError(res.sessionId);
      return res;
    },

    rescoreSession(sessionId) {
      return api.send<AssessmentOutcome>(
        `/api/sessions/${sessionId}/rescore`,
        {},
      );
    },

    setShotExcluded: (shotId, excluded) =>
      repos.shot.setExcluded(shotId, excluded),
  };
}
