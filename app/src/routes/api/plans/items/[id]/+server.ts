import { json, withUser } from "$lib/server/http";
import { ownership } from "$lib/server/context";

// PATCH /api/plans/items/:id → mark a plan item done.
export const PATCH = withUser(async (ctx, event) => {
  const id = event.params.id;
  if (!id) return json({ error: "id required" }, 400);
  await ownership(ctx).planItem(id);
  await ctx.domain.trainingPlan.completeItem(id);
  return json({ ok: true });
});
