import { json, withUser } from "$lib/server/http";
import { ownership } from "$lib/server/context";

// GET /api/plans/:id → a plan with its items.
export const GET = withUser(async (ctx, event) => {
  const id = event.params.id;
  if (!id) return json({ error: "id required" }, 400);
  await ownership(ctx).plan(id);
  const plan = await ctx.domain.trainingPlan.getPlan(id);
  if (!plan) return json({ error: "not found" }, 404);
  return json(plan);
});
