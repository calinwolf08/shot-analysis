import type { InsertScoreInput } from "$lib/shared/db/repos";
import { json, parseBody, withUser } from "$lib/server/http";
import { insertScoreBody, scoreScope } from "$lib/shared/api/contracts";

// GET /api/scores?scope=&refId=&mode=latest|list
//   mode=latest (default) → latestForRef, mode=list → listForRef
export const GET = withUser(async ({ repos }, event) => {
  const q = event.url.searchParams;
  const scope = scoreScope.parse(q.get("scope"));
  const refId = q.get("refId");
  if (!refId) return json({ error: "refId required" }, 400);
  if (q.get("mode") === "list") {
    return json(await repos.score.listForRef(scope, refId));
  }
  return json(await repos.score.latestForRef(scope, refId));
});

export const POST = withUser(async ({ repos }, event) => {
  const input = await parseBody(event, insertScoreBody);
  // breakdown is `unknown` (required by the repo; zod infers it optional).
  return json(await repos.score.insert(input as InsertScoreInput), 201);
});
