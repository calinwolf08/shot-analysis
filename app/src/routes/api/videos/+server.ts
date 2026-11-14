import { json, parseBody, withUser } from "$lib/server/http";
import { createVideoBody } from "$lib/shared/api/contracts";

export const POST = withUser(async ({ repos }, event) => {
  const input = await parseBody(event, createVideoBody);
  return json(await repos.video.create(input), 201);
});
