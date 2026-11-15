import { json, withUser } from "$lib/server/http";

// GET /api/drills/:id → a drill by id, falling back to slug lookup (global).
export const GET = withUser(async ({ domain }, event) => {
  const id = event.params.id;
  if (!id) return json({ error: "id required" }, 400);
  const drill =
    (await domain.drills.get(id)) ?? (await domain.drills.getBySlug(id));
  if (!drill) return json({ error: "not found" }, 404);
  return json(drill);
});
