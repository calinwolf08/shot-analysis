import { json, withUser } from "$lib/server/http";
import { ownership } from "$lib/server/context";

// GET /api/plans/items/:id → a single plan item.
export const GET = withUser(async (ctx, event) => {
  const id = event.params.id;
  if (!id) return json({ error: "id required" }, 400);
  await ownership(ctx).planItem(id);
  const item = await ctx.domain.trainingPlan.getItem(id);
  if (!item) return json({ error: "not found" }, 404);
  return json(item);
});

// PATCH /api/plans/items/:id → mark a plan item done.
export const PATCH = withUser(async (ctx, event) => {
  const id = event.params.id;
  if (!id) return json({ error: "id required" }, 400);
  await ownership(ctx).planItem(id);
  await ctx.domain.trainingPlan.completeItem(id);
  return json({ ok: true });
});
