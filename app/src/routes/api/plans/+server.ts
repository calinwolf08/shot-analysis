import { json, parseBody, withUser } from "$lib/server/http";
import { ownership } from "$lib/server/context";
import { generatePlanBody } from "$lib/shared/api/contracts";

// GET /api/plans?playerId=[&kind=active|next-pending]
//   kind=active (default) → getActivePlan, next-pending → nextPendingItem
export const GET = withUser(async (ctx, event) => {
  const q = event.url.searchParams;
  const playerId = q.get("playerId");
  if (!playerId) return json({ error: "playerId required" }, 400);
  await ownership(ctx).player(playerId);
  if (q.get("kind") === "next-pending") {
    return json(await ctx.domain.trainingPlan.nextPendingItem(playerId));
  }
  return json(await ctx.domain.trainingPlan.getActivePlan(playerId));
});

// POST /api/plans { sessionId, playerId } → generate a plan from the session.
export const POST = withUser(async (ctx, event) => {
  const { sessionId, playerId } = await parseBody(event, generatePlanBody);
  await ownership(ctx).player(playerId);
  await ownership(ctx).session(sessionId);
  return json(
    await ctx.domain.trainingPlan.generateForSession(sessionId, playerId),
    201,
  );
});
