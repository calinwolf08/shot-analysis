import { json, parseBody, withUser } from "$lib/server/http";
import { analyzeSessionBody } from "$lib/shared/api/contracts";
import { parsePoseData } from "$lib/server/analysis";
import { runSessionAnalysis } from "$lib/server/assessment";

// POST /api/analysis/session { playerId, videos[], planItemId? }
//   → run a full assessment server-side: detect → persist → score → diagnose.
export const POST = withUser(async (ctx, event) => {
  const body = await parseBody(event, analyzeSessionBody);
  const videos = body.videos.map((v) => ({
    poseData: parsePoseData(v.poseData),
    ...(v.durationMs !== undefined ? { durationMs: v.durationMs } : {}),
    ...(v.fps !== undefined ? { fps: v.fps } : {}),
  }));
  const outcome = await runSessionAnalysis(ctx, {
    playerId: body.playerId,
    videos,
    ...(body.planItemId ? { planItemId: body.planItemId } : {}),
  });
  return json(outcome, 201);
});
