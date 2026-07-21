/**
 * Server request pipeline:
 *  1. Ensure the auth tables exist (once per process).
 *  2. Resolve the caller's identity from the `Authorization: Bearer` header
 *     (the single auth mechanism for web and native) into `event.locals`.
 *  3. Apply CORS for cross-origin `/api/*` calls (the native app calls the
 *     API from `capacitor://localhost` / `http://localhost`).
 *
 * Data/analysis endpoints read `event.locals.user` to scope and authorize.
 */
import type { Handle } from "@sveltejs/kit";
import { getAuth, ensureAuthMigrated, TRUSTED_ORIGINS } from "$lib/server/auth";

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !TRUSTED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers": "set-auth-token",
    Vary: "Origin",
  };
}

export const handle: Handle = async ({ event, resolve }) => {
  await ensureAuthMigrated();

  const origin = event.request.headers.get("origin");
  const isApi = event.url.pathname.startsWith("/api/");

  // CORS preflight for cross-origin API calls (native shells).
  if (isApi && event.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  // Resolve identity only when the caller presents credentials.
  event.locals.user = null;
  event.locals.session = null;
  if (event.request.headers.get("authorization")) {
    const session = await getAuth().api.getSession({
      headers: event.request.headers,
    });
    if (session?.user) {
      const { id, email, name } = session.user;
      event.locals.user = { id, email, name };
      event.locals.session = session;
    }
  }

  const response = await resolve(event);

  if (isApi) {
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      response.headers.set(k, v);
    }
  }
  return response;
};
