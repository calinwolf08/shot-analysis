/**
 * Server-side assessment orchestration.
 *
 * Mirrors the client `AssessmentService.runAssessment` pipeline, but the
 * analysis runs here (from pose frames the client POSTs) and every write is
 * user-scoped. Detect → persist shots → score session → diagnose focus areas →
 * complete, returning the same outcome the results screen consumes.
 *
 * Server-only.
 */
import type { PoseData } from "basketball-shot-analysis";
import type { MetricName } from "$lib/features/benchmarks";
import { profileForLevel } from "$lib/features/assessment";
import type { AnalyzeOptions } from "$lib/features/analysis";
import type { UserContext } from "./context";
import { ForbiddenError } from "./errors";
import { analyzePoseData } from "./analysis";

export interface AnalyzedVideoInput {
  poseData: PoseData;
  durationMs?: number;
  fps?: number;
}

/** Options for analysis derived from the player's hand + level. */
async function optsForPlayer(
  ctx: UserContext,
  playerId: string,
): Promise<AnalyzeOptions> {
  const player = await ctx.repos.player.get(playerId);
  if (!player) throw new ForbiddenError("not your player");
  return {
    shootingHand: player.shootingHand,
    profile: profileForLevel(player.level),
  };
}

/** Scores + diagnoses a fully-populated session (shared by run + rescore). */
export async function scoreAndDiagnoseSession(
  ctx: UserContext,
  sessionId: string,
) {
  const benchmark = await ctx.domain.benchmarks.getActive();
  const { session, shots } = await ctx.domain.scoring.scoreAndPersistSession(
    sessionId,
    benchmark,
  );
  const focusAreas = await ctx.domain.diagnosis.diagnoseAndPersist(
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

/**
 * Full assessment: create a session, analyze each pose set, persist the shots,
 * then score + diagnose. Aborts the session (kept for history) when no shots
 * are detected. Returns the assembled outcome.
 */
export async function runSessionAnalysis(
  ctx: UserContext,
  input: {
    playerId: string;
    videos: AnalyzedVideoInput[];
    planItemId?: string;
  },
) {
  const opts = await optsForPlayer(ctx, input.playerId);
  const session = await ctx.repos.session.create({
    playerId: input.playerId,
    type: "assessment",
    ...(input.planItemId ? { planItemId: input.planItemId } : {}),
  });

  let totalShots = 0;
  for (const item of input.videos) {
    const result = analyzePoseData(item.poseData, opts);
    const meta = result.videoMetadata;
    const video = await ctx.repos.video.create({
      playerId: input.playerId,
      source: "upload",
      ...((item.durationMs ?? meta.duration)
        ? { durationMs: item.durationMs ?? meta.duration }
        : {}),
      ...((item.fps ?? meta.fps) ? { fps: item.fps ?? meta.fps } : {}),
      ...(meta.width ? { width: meta.width } : {}),
      ...(meta.height ? { height: meta.height } : {}),
    });
    for (const analysis of result.shots) {
      await ctx.repos.shot.saveAnalysis({
        sessionId: session.id,
        videoId: video.id,
        analysis,
      });
    }
    totalShots += result.shots.length;
  }

  if (totalShots === 0) {
    await ctx.repos.session.abort(session.id);
    return { sessionId: session.id, noShots: true as const };
  }

  const outcome = await scoreAndDiagnoseSession(ctx, session.id);
  await ctx.repos.session.complete(session.id);
  return outcome;
}

/**
 * Live/single-window analysis: analyze one pose window against an existing
 * session, persist the detected shots, and score each against the active
 * benchmark. Returns the scored shots.
 */
export async function runShotAnalysis(
  ctx: UserContext,
  input: { sessionId: string; playerId: string; poseData: PoseData },
) {
  const opts = await optsForPlayer(ctx, input.playerId);
  const session = await ctx.repos.session.get(input.sessionId);
  if (!session) throw new ForbiddenError("not your session");
  const focusMetric = (session.focusMetric ?? undefined) as
    | MetricName
    | undefined;
  const benchmark = await ctx.domain.benchmarks.getActive();
  const result = analyzePoseData(input.poseData, opts);

  const scored = [];
  for (const analysis of result.shots) {
    const shot = await ctx.repos.shot.saveAnalysis({
      sessionId: input.sessionId,
      analysis,
    });
    scored.push(
      await ctx.domain.scoring.scoreAndPersistShot(
        shot,
        benchmark,
        focusMetric,
      ),
    );
  }
  return { shots: scored };
}
