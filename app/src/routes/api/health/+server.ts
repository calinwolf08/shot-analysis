/**
 * Liveness probe. Returns `{ ok: true }` only if the server database can be
 * opened (and migrated on first hit). Replaces the retired auth-server
 * `/health`. Used by deploy health checks and the e2e harness.
 */
import { json } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  await getDb();
  return json({ ok: true });
};
