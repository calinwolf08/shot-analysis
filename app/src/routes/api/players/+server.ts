import { json, parseBody, withUser } from "$lib/server/http";
import { createPlayerBody } from "$lib/shared/api/contracts";

export const POST = withUser(async ({ repos }, event) => {
  const input = await parseBody(event, createPlayerBody);
  return json(await repos.player.create(input), 201);
});
