import type { ShotAnalysis } from "basketball-shot-analysis";
import { json, parseBody, withUser } from "$lib/server/http";
import { saveAnalysisBody } from "$lib/shared/api/contracts";

// GET /api/shots?playerId=&since=&limit=&includeExcluded=  → listByPlayer
//     /api/shots?sessionId=&includeExcluded=               → listBySession
export const GET = withUser(async ({ repos }, event) => {
  const q = event.url.searchParams;
  const includeExcluded = q.get("includeExcluded") === "true";
  const playerId = q.get("playerId");
  if (playerId) {
    const since = q.get("since");
    const limit = q.get("limit");
    return json(
      await repos.shot.listByPlayer(playerId, {
        includeExcluded,
        ...(since !== null ? { since: Number(since) } : {}),
        ...(limit !== null ? { limit: Number(limit) } : {}),
      }),
    );
  }
  // sessionId branch: assessment/upload path only (live uses playerId above).
  const sessionId = q.get("sessionId");
  if (!sessionId) return json({ error: "playerId or sessionId required" }, 400);
  return json(await repos.shot.listBySession(sessionId, { includeExcluded }));
});

export const POST = withUser(async ({ repos }, event) => {
  const input = await parseBody(event, saveAnalysisBody);
  return json(
    await repos.shot.saveAnalysis({
      ...(input.playerId !== undefined ? { playerId: input.playerId } : {}),
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
      videoId: input.videoId,
      analysis: input.analysis as unknown as ShotAnalysis,
    }),
    201,
  );
});
