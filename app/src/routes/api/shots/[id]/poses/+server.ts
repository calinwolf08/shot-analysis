import { json, withUser } from "$lib/server/http";

// GET /api/shots/:id/poses → the shot's review pose track (skeleton fallback),
// or 404 when none was stored (older shots, or analysis without poses).
export const GET = withUser(async ({ repos }, event) => {
  const poses = await repos.shot.getPoses(event.params.id!);
  if (!poses) return json({ error: "no poses" }, 404);
  return json(poses);
});
