import { json, withUser } from "$lib/server/http";
import { ownership } from "$lib/server/context";

// GET /api/diagnosis?sessionId= → the session's ranked focus areas.
export const GET = withUser(async (ctx, event) => {
  const sessionId = event.url.searchParams.get("sessionId");
  if (!sessionId) return json({ error: "sessionId required" }, 400);
  await ownership(ctx).session(sessionId);
  return json(await ctx.domain.diagnosis.listForSession(sessionId));
});
