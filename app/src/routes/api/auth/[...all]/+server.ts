/**
 * better-auth's catch-all endpoint. Every `/api/auth/*` request (sign-up,
 * sign-in, get-session, sign-out, password reset, …) is delegated to the
 * better-auth handler. The bearer plugin means sign-in/up return the session
 * token in a `set-auth-token` response header; clients send it back as
 * `Authorization: Bearer`.
 */
import { getAuth, ensureAuthMigrated } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

const handle: RequestHandler = async ({ request }) => {
  await ensureAuthMigrated();
  return getAuth().handler(request);
};

export const GET = handle;
export const POST = handle;
