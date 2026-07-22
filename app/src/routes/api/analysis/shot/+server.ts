import { json, parseBody, withUser } from "$lib/server/http";
import { analyzeShotBody } from "$lib/shared/api/contracts";
import { parsePoseData } from "$lib/server/analysis";
import { runShotAnalysis } from "$lib/server/assessment";

// POST /api/analysis/shot { sessionId, playerId, poseData }
//   → analyze one pose window, persist + score the detected shots.
export const POST = withUser(async (ctx, event) => {
  const body = await parseBody(event, analyzeShotBody);
  const poseData = parsePoseData(body.poseData);
  const result = await runShotAnalysis(ctx, {
    sessionId: body.sessionId,
    playerId: body.playerId,
    poseData,
  });
  return json(result, 201);
});
