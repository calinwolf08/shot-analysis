import { json, parseBody, withUser } from "$lib/server/http";
import { ownership } from "$lib/server/context";
import { reassessPlanBody } from "$lib/shared/api/contracts";

// POST /api/plans/reassess { sessionId, playerId, planItemId }
//   → completes the reassessment item and generates the next adapted plan.
export const POST = withUser(async (ctx, event) => {
  const { sessionId, playerId, planItemId } = await parseBody(
    event,
    reassessPlanBody,
  );
  await ownership(ctx).player(playerId);
  await ownership(ctx).session(sessionId);
  await ownership(ctx).planItem(planItemId);
  return json(
    await ctx.domain.trainingPlan.completeReassessment(
      sessionId,
      playerId,
      planItemId,
    ),
    201,
  );
});
