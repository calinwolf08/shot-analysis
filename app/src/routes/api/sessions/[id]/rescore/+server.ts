import { json, withUser } from "$lib/server/http";
import { ownership } from "$lib/server/context";
import { scoreAndDiagnoseSession } from "$lib/server/assessment";

// POST /api/sessions/:id/rescore → re-score + re-diagnose after exclusions
//   changed. Returns the reassembled assessment outcome.
export const POST = withUser(async (ctx, event) => {
  const sessionId = event.params.id!;
  await ownership(ctx).session(sessionId);
  return json(await scoreAndDiagnoseSession(ctx, sessionId));
});
