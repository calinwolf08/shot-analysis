import { json, parseBody, withUser } from "$lib/server/http";
import { sessionActionBody } from "$lib/shared/api/contracts";

export const GET = withUser(async ({ repos }, event) => {
  return json(await repos.session.get(event.params.id!));
});

// PATCH { action: "complete" | "abort" }
export const PATCH = withUser(async ({ repos }, event) => {
  const { action } = await parseBody(event, sessionActionBody);
  const id = event.params.id!;
  if (action === "complete") await repos.session.complete(id);
  else await repos.session.abort(id);
  return json({ ok: true });
});
