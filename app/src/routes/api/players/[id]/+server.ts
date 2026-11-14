import { json, parseBody, withUser } from "$lib/server/http";
import { updatePlayerBody } from "$lib/shared/api/contracts";

// Returns the player or null (repo semantics; the client mirrors get(id)).
export const GET = withUser(async ({ repos }, event) => {
  return json(await repos.player.get(event.params.id!));
});

export const PATCH = withUser(async ({ repos }, event) => {
  const patch = await parseBody(event, updatePlayerBody);
  return json(await repos.player.update(event.params.id!, patch));
});
