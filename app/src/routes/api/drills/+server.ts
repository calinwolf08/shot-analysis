import { json, withUser } from "$lib/server/http";

// GET /api/drills → the full drill catalog (global).
export const GET = withUser(async ({ domain }) => {
  return json(await domain.drills.list());
});
