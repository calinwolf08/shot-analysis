import { json, parseBody, withUser } from "$lib/server/http";
import { latestForRefsBody } from "$lib/shared/api/contracts";

// POST { scope, refIds[] } → { [refId]: ScoreRecord } (only owned refs present)
export const POST = withUser(async ({ repos }, event) => {
  const { scope, refIds } = await parseBody(event, latestForRefsBody);
  const map = await repos.score.latestForRefs(scope, refIds);
  return json(Object.fromEntries(map));
});
