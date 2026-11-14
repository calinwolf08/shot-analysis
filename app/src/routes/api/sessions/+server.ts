import { json, parseBody, withUser } from "$lib/server/http";
import {
  createSessionBody,
  sessionStatus,
  sessionType,
} from "$lib/shared/api/contracts";

// GET /api/sessions?playerId=&type=&status=  → listByPlayer
export const GET = withUser(async ({ repos }, event) => {
  const q = event.url.searchParams;
  const playerId = q.get("playerId");
  if (!playerId) return json({ error: "playerId required" }, 400);
  const type = q.get("type");
  const status = q.get("status");
  const filter: { type?: never; status?: never } = {};
  if (type) (filter as Record<string, string>).type = sessionType.parse(type);
  if (status)
    (filter as Record<string, string>).status = sessionStatus.parse(status);
  return json(await repos.session.listByPlayer(playerId, filter));
});

export const POST = withUser(async ({ repos }, event) => {
  const input = await parseBody(event, createSessionBody);
  return json(await repos.session.create(input), 201);
});
