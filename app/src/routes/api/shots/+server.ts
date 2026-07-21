import type { ShotAnalysis } from "basketball-shot-analysis";
import { json, parseBody, withUser } from "$lib/server/http";
import { saveAnalysisBody } from "$lib/shared/api/contracts";

// GET /api/shots?sessionId=&includeExcluded=  → listBySession
export const GET = withUser(async ({ repos }, event) => {
  const q = event.url.searchParams;
  const sessionId = q.get("sessionId");
  if (!sessionId) return json({ error: "sessionId required" }, 400);
  const includeExcluded = q.get("includeExcluded") === "true";
  return json(await repos.shot.listBySession(sessionId, { includeExcluded }));
});

export const POST = withUser(async ({ repos }, event) => {
  const input = await parseBody(event, saveAnalysisBody);
  return json(
    await repos.shot.saveAnalysis({
      sessionId: input.sessionId,
      videoId: input.videoId,
      analysis: input.analysis as unknown as ShotAnalysis,
    }),
    201,
  );
});
