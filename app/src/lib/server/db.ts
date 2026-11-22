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

/** The configured SQLite file path (tests inspect it; throws on Postgres). */
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
  /** Raw-SQL adapter: SQLite only (tests); a throwing stub on Postgres. */
  readonly adapter: DatabaseAdapter;
  readonly kysely: AppDatabase;
}

/**
 * The open connection (created synchronously — a SQLite file handle or a lazy
 * Postgres pool), shared by the app repos AND better-auth (see ./auth).
 */
let connection: ServerDb | null = null;
/** Migrated + seeded. */
let dbPromise: Promise<ServerDb> | null = null;

function connect(): ServerDb {
  if (connection) return connection;
  const config: DbConfig = resolveDbConfig(process.env, { building });
  if (config.kind === "postgres") {
    connection = {
      adapter: noRawSql("the Postgres server"),
      kysely: { kind: "postgres", db: createPostgresKysely(config.url) },
    };
  } else {
    if (config.path !== ":memory:") {
      mkdirSync(dirname(config.path), { recursive: true });
    }
    // One connection, shared by Kysely and the raw-SQL adapter (the legacy
    // migration runner on an older file, and tests).
    const conn = openBetterSqlite(config.path);
    connection = {
      adapter: createBetterSqliteAdapterFor(conn),
      kysely: { kind: "sqlite", db: createSqliteKysely(conn) },
    };
  }
  console.info(`[db] ${describeDbConfig(config)}`);
  return connection;
}

/**
 * The shared database connection, NOT necessarily migrated yet — for
 * better-auth, which runs its own migrations (ensureAuthMigrated).
 */
export function getConnection(): AppDatabase {
  return connect().kysely;
}

async function open(): Promise<ServerDb> {
  const server = connect();
  await migrateDatabase(
    server.kysely,
    server.kysely.kind === "sqlite" ? { legacy: server.adapter } : {},
  );
  await seedGlobals(server.kysely.db);
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

/** The same database through Kysely (typed; SQLite or Postgres), migrated. */
export async function getKysely(): Promise<AppDatabase> {
  return (await server()).kysely;
}

/**
 * Test/teardown helper: drop the cached singleton so the next {@link getDb}
 * opens a fresh connection. Does not close the previous handle — callers that
 * need that should close it themselves.
 */
export function resetDbSingletonForTests(): void {
  connection = null;
  dbPromise = null;
}

/**
 * Test hook: make the server use an already-migrated database (e.g. PGlite)
 * instead of resolving one from the environment. Seeds the global catalogs.
 */
export function useDatabaseForTests(kysely: AppDatabase): void {
  connection = { adapter: noRawSql(`the ${kysely.kind} test server`), kysely };
  dbPromise = seedGlobals(kysely.db).then(() => connection!);
}
