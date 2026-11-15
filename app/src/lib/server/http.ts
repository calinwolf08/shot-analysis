/**
 * HTTP helpers for `/api/*` route handlers: typed JSON responses and a
 * `withUser` wrapper that authenticates the request, builds the user-scoped
 * repos, and maps thrown errors to status codes.
 */
import { json as skJson } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { ZodError, type ZodType } from "zod";
import { ForbiddenError, UnauthorizedError } from "./errors";
import { requireUser, type UserContext } from "./context";

export function json(data: unknown, status = 200): Response {
  return skJson(data, { status });
}

/** Maps a thrown error to an HTTP JSON response. */
export function errorResponse(err: unknown): Response {
  if (err instanceof UnauthorizedError)
    return json({ error: err.message }, 401);
  if (err instanceof ForbiddenError) return json({ error: err.message }, 403);
  if (err instanceof ZodError) {
    return json({ error: "Invalid request", issues: err.issues }, 400);
  }
  const message = err instanceof Error ? err.message : "Internal error";
  return json({ error: message }, 500);
}

/**
 * Wraps a route handler so it receives the authenticated user + scoped repos.
 * A missing session → 401; ForbiddenError → 403; ZodError → 400; anything else
 * → 500. Handlers can throw the typed errors and stay terse.
 */
export function withUser(
  handler: (ctx: UserContext, event: RequestEvent) => Promise<Response>,
): (event: RequestEvent) => Promise<Response> {
  return async (event) => {
    try {
      const ctx = await requireUser(event);
      return await handler(ctx, event);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Parses + validates a JSON request body against a zod schema (throws ZodError). */
export async function parseBody<T>(
  event: RequestEvent,
  schema: ZodType<T>,
): Promise<T> {
  const body = await event.request.json().catch(() => ({}));
  return schema.parse(body);
}
