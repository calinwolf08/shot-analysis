/**
 * The single server-side database.
 *
 * One `better-sqlite3`-backed {@link DatabaseAdapter} for the whole process,
 * created lazily and migrated on first access. Every server module (auth,
 * repos, analysis) shares this one handle — see `$lib/server/README.md`.
 *
 * Server-only: never import from client code. The path comes from the
 * environment so deployments can point at a persistent volume
 * (see docs/hosting-and-deployment.md).
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DatabaseAdapter } from "$lib/shared/db";
import { migrate } from "$lib/shared/db";
import { createBetterSqliteAdapter } from "$lib/shared/db/drivers/better-sqlite3";

/** Resolves the DB file path from env, defaulting to a local dev file. */
export function databasePath(): string {
  return (
    process.env.DATABASE_PATH ??
    process.env.DATABASE_URL ??
    "./data/shotcoach.sqlite"
  );
}

let dbPromise: Promise<DatabaseAdapter> | null = null;

async function open(): Promise<DatabaseAdapter> {
  const path = databasePath();
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = createBetterSqliteAdapter({ path });
  await migrate(db);
  return db;
}

/**
 * The process-wide database singleton, migrated on first call. Subsequent calls
 * return the same instance.
 */
export function getDb(): Promise<DatabaseAdapter> {
  if (!dbPromise) {
    dbPromise = open().catch((err) => {
      // Reset so a transient failure (e.g. bad path) can be retried.
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/**
 * Test/teardown helper: drop the cached singleton so the next {@link getDb}
 * opens a fresh connection. Does not close the previous handle — callers that
 * need that should close it themselves.
 */
export function resetDbSingletonForTests(): void {
  dbPromise = null;
}
