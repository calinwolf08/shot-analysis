/**
 * Per-request server context: resolve the authenticated user (set by
 * hooks.server.ts) and build the user-scoped repositories over the single DB.
 */
import type { RequestEvent } from "@sveltejs/kit";
import type { AppRepos } from "$lib/shared/config/services";
import { getDb } from "./db";
import { createServerRepos } from "./repos";
import { UnauthorizedError } from "./errors";

export interface UserContext {
  userId: string;
  repos: AppRepos;
}

/**
 * Returns the authenticated user's id + scoped repos, or throws
 * {@link UnauthorizedError} when there is no session. `event.locals.user` is
 * populated by `hooks.server.ts` from the bearer token.
 */
export async function requireUser(event: RequestEvent): Promise<UserContext> {
  const user = event.locals.user;
  if (!user) throw new UnauthorizedError();
  const repos = createServerRepos(await getDb(), user.id);
  return { userId: user.id, repos };
}
