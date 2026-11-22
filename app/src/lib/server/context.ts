/**
 * Per-request server context: resolve the authenticated user (set by
 * hooks.server.ts) and build the user-scoped repositories + domain services
 * over the single DB.
 */
import type { RequestEvent } from "@sveltejs/kit";
import type { AppKysely } from "./database/kysely";
import type { AppRepos } from "$lib/shared/config/services";
import { getKysely } from "./db";
import { createServerRepos } from "./repos";
import { createServerDomain, type ServerDomain } from "./services";
import { ForbiddenError, UnauthorizedError } from "./errors";

export interface UserContext {
  userId: string;
  kdb: AppKysely;
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
  const { db: kdb } = await getKysely();
  const repos = createServerRepos(kdb, user.id);
  const domain = createServerDomain(kdb, user.id);
  return { userId: user.id, kdb, repos, domain };
}

/**
 * Boundary ownership guards for resources the domain services key by an id the
 * scoped repos don't cover (plans, plan items, session-scoped focus areas).
 * Ownership always roots at `players.user_id`. Throws {@link ForbiddenError}
 * when the resource is missing or owned by another user (missing and forbidden
 * are deliberately indistinguishable so ids can't be probed).
 */
export function ownership(ctx: UserContext) {
  const { kdb, userId } = ctx;
  const owns = async (q: { executeTakeFirst(): Promise<unknown> }) => {
    if ((await q.executeTakeFirst()) === undefined)
      throw new ForbiddenError("not yours");
  };
  return {
    session: (id: string) =>
      owns(
        kdb
          .selectFrom("sessions")
          .select("id")
          .where("id", "=", id)
          .where("user_id", "=", userId),
      ),
    player: (id: string) =>
      owns(
        kdb
          .selectFrom("players")
          .select("id")
          .where("id", "=", id)
          .where("user_id", "=", userId),
      ),
    plan: (id: string) =>
      owns(
        kdb
          .selectFrom("plans as p")
          .innerJoin("players as pl", "p.player_id", "pl.id")
          .select("p.id")
          .where("p.id", "=", id)
          .where("pl.user_id", "=", userId),
      ),
    planItem: (id: string) =>
      owns(
        kdb
          .selectFrom("plan_items as i")
          .innerJoin("plans as p", "i.plan_id", "p.id")
          .innerJoin("players as pl", "p.player_id", "pl.id")
          .select("i.id")
          .where("i.id", "=", id)
          .where("pl.user_id", "=", userId),
      ),
  };
}
