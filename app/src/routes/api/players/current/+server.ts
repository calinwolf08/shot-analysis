import { json, withUser } from "$lib/server/http";

// The signed-in user's player (or null → the client routes to onboarding).
export const GET = withUser(async ({ repos }) => {
  return json(await repos.player.getFirst());
});
