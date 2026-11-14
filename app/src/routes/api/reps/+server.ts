import { json, parseBody, withUser } from "$lib/server/http";
import { createRepBody } from "$lib/shared/api/contracts";

// GET /api/reps?sessionId=  → listBySession
export const GET = withUser(async ({ repos }, event) => {
  const sessionId = event.url.searchParams.get("sessionId");
  if (!sessionId) return json({ error: "sessionId required" }, 400);
  return json(await repos.rep.listBySession(sessionId));
});

export const POST = withUser(async ({ repos }, event) => {
  const input = await parseBody(event, createRepBody);
  return json(await repos.rep.create(input), 201);
});
