/**
 * Per-request server context: resolve the authenticated user (set by
 * hooks.server.ts) and build the user-scoped repositories + domain services
 * over the single DB.
 */
import type { RequestEvent } from "@sveltejs/kit";
import type { DatabaseAdapter } from "$lib/shared/db";
import type { AppRepos } from "$lib/shared/config/services";
import { getDb } from "./db";
import { createServerRepos } from "./repos";
import { createServerDomain, type ServerDomain } from "./services";
import { ForbiddenError, UnauthorizedError } from "./errors";

export interface UserContext {
  userId: string;
  db: DatabaseAdapter;
  repos: AppRepos;
  domain: ServerDomain;
}

/**
 * Returns the authenticated user's id, scoped repos, and domain services, or
 * throws {@link UnauthorizedError} when there is no session.
 * `event.locals.user` is populated by `hooks.server.ts` from the bearer token.
 */
export async function requireUser(event: RequestEvent): Promise<UserContext> {
  const user = event.locals.user;
  if (!user) throw new UnauthorizedError();
  const db = await getDb();
  const repos = createServerRepos(db, user.id);
  const domain = createServerDomain(db, user.id);
  return { userId: user.id, db, repos, domain };
}

/**
 * Boundary ownership guards for resources the domain services key by an id the
 * scoped repos don't cover (plans, plan items, session-scoped focus areas).
 * Ownership always roots at `players.user_id`. Throws {@link ForbiddenError}
 * when the resource is missing or owned by another user (missing and forbidden
 * are deliberately indistinguishable so ids can't be probed).
 */
export function ownership(ctx: UserContext) {
  const { db, userId } = ctx;
  const owns = async (sql: string, params: (string | number)[]) => {
    if ((await db.query(sql, params)).length === 0)
      throw new ForbiddenError("not yours");
  };
  return {
    session: (id: string) =>
      owns("SELECT 1 FROM sessions WHERE id = ? AND user_id = ?", [id, userId]),
    player: (id: string) =>
      owns("SELECT 1 FROM players WHERE id = ? AND user_id = ?", [id, userId]),
    plan: (id: string) =>
      owns(
        `SELECT 1 FROM plans p JOIN players pl ON p.player_id = pl.id
         WHERE p.id = ? AND pl.user_id = ?`,
        [id, userId],
      ),
    planItem: (id: string) =>
      owns(
        `SELECT 1 FROM plan_items i
         JOIN plans p ON i.plan_id = p.id
         JOIN players pl ON p.player_id = pl.id
         WHERE i.id = ? AND pl.user_id = ?`,
        [id, userId],
      ),
  };
}
