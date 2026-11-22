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
import {
  createPostgresKysely,
  createSqliteKysely,
  type AppDatabase,
} from "./database/kysely";
import { noRawSql } from "$lib/shared/db/repo-base";
import { migrateDatabase } from "./database/migrate";

/**
 * The SQLite file path (better-auth still opens it directly until it moves to
 * the shared connection — docs/database-abstraction-plan.md Phase 4).
 */
export function databasePath(): string {
  const c = resolveDbConfig(process.env, { building });
  if (c.kind !== "sqlite") {
    throw new DatabaseConfigError(
      "Sign-in (better-auth) doesn't run on Postgres yet — it moves onto the shared " +
        "connection in database-abstraction-plan Phase 4. The app data layer is ready; " +
        "use DATABASE_PATH until then.",
    );
  }
  return c.path;
}

interface ServerDb {
  /** Raw-SQL adapter: SQLite only (tests); a throwing stub on Postgres. */
  readonly adapter: DatabaseAdapter;
  readonly kysely: AppDatabase;
}

let dbPromise: Promise<ServerDb> | null = null;

async function open(): Promise<ServerDb> {
  const config: DbConfig = resolveDbConfig(process.env, { building });
  let server: ServerDb;
  if (config.kind === "postgres") {
    const kysely: AppDatabase = {
      kind: "postgres",
      db: createPostgresKysely(config.url),
    };
    await migrateDatabase(kysely);
    server = { adapter: noRawSql("the Postgres server"), kysely };
  } else {
    if (config.path !== ":memory:") {
      mkdirSync(dirname(config.path), { recursive: true });
    }
    // One connection, shared by Kysely and the raw-SQL adapter (the legacy
    // migration runner on an older file, and tests).
    const conn = openBetterSqlite(config.path);
    const adapter = createBetterSqliteAdapterFor(conn);
    const kysely: AppDatabase = {
      kind: "sqlite",
      db: createSqliteKysely(conn),
    };
    await migrateDatabase(kysely, { legacy: adapter });
    server = { adapter, kysely };
  }
  await seedGlobals(server.kysely.db);
  console.info(`[db] ${describeDbConfig(config)} ready`);
  return server;
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
 * The raw-SQL adapter (SQLite only — tests that inspect the file directly).
 * Server code uses {@link getKysely}.
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

/**
 * Test hook: make the server use an already-migrated database (e.g. PGlite)
 * instead of resolving one from the environment. Seeds the global catalogs.
 */
export function useDatabaseForTests(kysely: AppDatabase): void {
  dbPromise = seedGlobals(kysely.db).then(() => ({
    adapter: noRawSql(`the ${kysely.kind} test server`),
    kysely,
  }));
}
