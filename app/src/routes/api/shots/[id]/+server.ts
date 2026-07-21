import { json, parseBody, withUser } from "$lib/server/http";
import { setExcludedBody } from "$lib/shared/api/contracts";

export const GET = withUser(async ({ repos }, event) => {
  return json(await repos.shot.get(event.params.id!));
});

export const PATCH = withUser(async ({ repos }, event) => {
  const { excluded } = await parseBody(event, setExcludedBody);
  await repos.shot.setExcluded(event.params.id!, excluded);
  return json({ ok: true });
});
