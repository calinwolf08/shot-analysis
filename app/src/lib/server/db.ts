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
import { building } from "$app/environment";
import { dirname } from "node:path";
import type { DatabaseAdapter } from "$lib/shared/db";
import {
  createBetterSqliteAdapterFor,
  openBetterSqlite,
} from "$lib/shared/db/drivers/better-sqlite3";
import { seedGlobals } from "./services";
import {
  DatabaseConfigError,
  describeDbConfig,
  resolveDbConfig,
  type DbConfig,
} from "./database/config";
import { createSqliteKysely, type AppDatabase } from "./database/kysely";
import { migrateDatabase } from "./database/migrate";

/**
 * The SQLite file path (better-auth still opens it directly until it moves to
 * the shared connection — docs/database-abstraction-plan.md Phase 4).
 */
export function databasePath(): string {
  const c = resolveDbConfig(process.env, { building });
  if (c.kind !== "sqlite") {
    throw new DatabaseConfigError(
      "databasePath() is SQLite-only; the server is configured for Postgres.",
    );
  }
  return c.path;
}

interface ServerDb {
  readonly adapter: DatabaseAdapter;
  readonly kysely: AppDatabase;
}

let dbPromise: Promise<ServerDb> | null = null;

async function open(): Promise<ServerDb> {
  const config: DbConfig = resolveDbConfig(process.env, { building });
  if (config.kind === "postgres") {
    // The config, dialect and migrations support Postgres; the server's
    // queries move to Kysely in Phase 3 of docs/database-abstraction-plan.md.
    throw new DatabaseConfigError(
      `DATABASE_URL points at Postgres (${describeDbConfig(config)}), but the server's queries ` +
        "don't run on Postgres yet (database-abstraction-plan Phase 3). Use DATABASE_PATH for now.",
    );
  }
  if (config.path !== ":memory:") {
    mkdirSync(dirname(config.path), { recursive: true });
  }
  // One connection, shared by the raw-SQL repos (until Phase 3) and Kysely.
  const conn = openBetterSqlite(config.path);
  const adapter = createBetterSqliteAdapterFor(conn);
  const kysely: AppDatabase = { kind: "sqlite", db: createSqliteKysely(conn) };
  await migrateDatabase(kysely, { legacy: adapter });
  await seedGlobals(adapter);
  return { adapter, kysely };
}

function server(): Promise<ServerDb> {
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
 * The process-wide database (raw-SQL adapter), migrated on first call.
 * Subsequent calls return the same instance.
 */
export async function getDb(): Promise<DatabaseAdapter> {
  return (await server()).adapter;
}

/** The same database through Kysely (typed; SQLite or Postgres). */
export async function getKysely(): Promise<AppDatabase> {
  return (await server()).kysely;
}

/**
 * Test/teardown helper: drop the cached singleton so the next {@link getDb}
 * opens a fresh connection. Does not close the previous handle — callers that
 * need that should close it themselves.
 */
export function resetDbSingletonForTests(): void {
  dbPromise = null;
}
