import { json, withUser } from "$lib/server/http";

export const GET = withUser(async ({ repos }, event) => {
  return json(await repos.video.get(event.params.id!));
});
