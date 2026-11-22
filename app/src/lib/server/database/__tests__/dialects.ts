/**
 * Test-only: every database the server supports, for `describe.each`.
 *
 *  - sqlite              — in-memory better-sqlite3 (always)
 *  - postgres (PGlite)   — in-process Postgres (always; no Docker needed)
 *  - postgres (server)   — a REAL Postgres server, when TEST_DATABASE_URL is
 *                          set (CI runs a postgres service container). Each
 *                          test starts from an emptied `public` schema, so the
 *                          suites using it must run one file at a time:
 *                          `npm run test:db` (vitest --no-file-parallelism).
 *                          (Per-test schemas via search_path would allow
 *                          parallelism on real Postgres, but can't be checked
 *                          against PGlite's socket server, which shares one
 *                          session across connections.)
 *
 * Use `disposeTestDatabase(app)` in afterEach (closes the connection).
 */
import { sql } from "kysely";
import {
  createBetterSqliteAdapterFor,
  openBetterSqlite,
} from "$lib/shared/db/drivers/better-sqlite3";
import type { DatabaseAdapter } from "$lib/shared/db";
import {
  createPostgresKysely,
  createSqliteKysely,
  type AppDatabase,
} from "../kysely";
import { migrateDatabase } from "../migrate";
import { createPgliteDatabase } from "./pglite";

export interface FreshDatabase {
  readonly app: AppDatabase;
  /** SQLite only: a raw adapter on the same connection (legacy upgrade path). */
  readonly legacy?: DatabaseAdapter;
}

type Provider = () => Promise<FreshDatabase>;

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim() || null;

/** An empty database of each kind (NOT migrated). */
export const FRESH_DATABASES: [string, Provider][] = [
  [
    "sqlite",
    async () => {
      const conn = openBetterSqlite(":memory:");
      return {
        app: { kind: "sqlite", db: createSqliteKysely(conn) },
        legacy: createBetterSqliteAdapterFor(conn),
      };
    },
  ],
  ["postgres (PGlite)", async () => ({ app: createPgliteDatabase() })],
  ...(TEST_DATABASE_URL
    ? ([["postgres (server)", () => serverSchema(TEST_DATABASE_URL)]] as [
        string,
        Provider,
      ][])
    : []),
];

/** Only the Postgres ones. */
export const FRESH_POSTGRES = FRESH_DATABASES.filter(([n]) =>
  n.startsWith("postgres"),
);

/** A migrated database of each kind. */
export const TEST_DATABASES: [string, () => Promise<AppDatabase>][] =
  FRESH_DATABASES.map(([name, fresh]) => [
    name,
    async () => {
      const { app, legacy } = await fresh();
      await migrateDatabase(app, legacy ? { legacy } : {});
      return app;
    },
  ]);

/** The real server, with its `public` schema emptied first. */
async function serverSchema(url: string): Promise<FreshDatabase> {
  const admin = createPostgresKysely(url, { max: 1 });
  await sql`DROP SCHEMA IF EXISTS public CASCADE`.execute(admin);
  await sql`CREATE SCHEMA public`.execute(admin);
  await admin.destroy();
  return { app: { kind: "postgres", db: createPostgresKysely(url) } };
}

/** Closes a test database. */
export async function disposeTestDatabase(app: AppDatabase): Promise<void> {
  await app.db.destroy();
}
