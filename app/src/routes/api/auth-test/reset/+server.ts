/**
 * E2E-only: wipes all user + user-data rows for a clean slate, keeping the
 * global catalogs (benchmarks, drills, settings) that are seeded at boot.
 * Gated by AUTH_E2E — returns 404 in normal builds. Deletes children before
 * parents so SQLite's foreign keys stay satisfied.
 */
import { error, json } from "@sveltejs/kit";
import { sql } from "kysely";
import { getKysely } from "$lib/server/db";
import type { RequestHandler } from "./$types";

// Child → parent order. Global catalogs are intentionally preserved.
const TABLES = [
  "shot_poses",
  "user_settings",
  "shot_metrics",
  "scores",
  "reps",
  "plan_items",
  "plans",
  "focus_areas",
  "shots",
  "videos",
  "sessions",
  "players",
  "account",
  "session",
  "verification",
  "user",
];

export const POST: RequestHandler = async () => {
  if (process.env.AUTH_E2E !== "1") throw error(404, "Not found");
  const { db } = await getKysely();
  for (const table of TABLES) {
    try {
      // sql.table quotes the name (`user` / `session` are reserved words).
      await sql`DELETE FROM ${sql.table(table)}`.execute(db);
    } catch {
      // A table may not exist yet (e.g. before first auth migration) — skip.
    }
  }
  return json({ ok: true });
};
