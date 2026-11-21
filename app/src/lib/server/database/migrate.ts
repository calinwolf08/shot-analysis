/**
 * Brings the server database to the latest schema, on SQLite or Postgres.
 *
 * 1. SQLite only: if the file was created by the legacy runner (it has a
 *    `schema_migrations` table), finish the legacy migrations 001–007 first,
 *    on the same connection — they include data steps (e.g. 006, 007) that
 *    only make sense on an existing database.
 * 2. Kysely's Migrator runs the portable migrations (./migrations). The
 *    baseline creates the schema on a fresh database and is a no-op on an
 *    upgraded one; later migrations apply to both.
 *
 * Idempotent: safe on every boot.
 *
 * Server-only.
 */
import { sql } from "kysely";
import {
  Migrator,
  type Migration,
  type MigrationProvider,
} from "kysely/migration";
import { migrate as migrateLegacy } from "$lib/shared/db";
import type { DatabaseAdapter } from "$lib/shared/db";
import type { AppDatabase } from "./kysely";
import { baselineMigration } from "./migrations/0001-baseline";

/** The portable migrations, in order (names sort lexically). */
export function appMigrations(
  kind: AppDatabase["kind"],
): Record<string, Migration> {
  return {
    "0001-baseline": baselineMigration(kind),
  };
}

export interface MigrateDatabaseResult {
  /** Legacy versions applied by step 1 (SQLite upgrade path). */
  readonly legacyApplied: number[];
  /** Portable migrations applied by step 2. */
  readonly applied: string[];
}

async function hasLegacyBookkeeping(app: AppDatabase): Promise<boolean> {
  if (app.kind !== "sqlite") return false;
  const rows = await sql<{
    name: string;
  }>`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'`.execute(
    app.db,
  );
  return rows.rows.length > 0;
}

export async function migrateDatabase(
  app: AppDatabase,
  opts: {
    /** Raw-SQL adapter on the SAME SQLite connection (legacy upgrade path). */
    legacy?: DatabaseAdapter;
    /** Override the migration set (tests). */
    migrations?: Record<string, Migration>;
  } = {},
): Promise<MigrateDatabaseResult> {
  let legacyApplied: number[] = [];
  if (opts.legacy && (await hasLegacyBookkeeping(app))) {
    legacyApplied = (await migrateLegacy(opts.legacy)).applied;
  }

  const migrations = opts.migrations ?? appMigrations(app.kind);
  const provider: MigrationProvider = { getMigrations: async () => migrations };
  const { error, results } = await new Migrator({
    db: app.db,
    provider,
  }).migrateToLatest();
  if (error) {
    const failed = results?.find((r) => r.status === "Error");
    throw new Error(
      `Database migration failed${failed ? ` at ${failed.migrationName}` : ""}: ${String(
        error instanceof Error ? error.message : error,
      )}`,
    );
  }
  return {
    legacyApplied,
    applied: (results ?? [])
      .filter((r) => r.status === "Success")
      .map((r) => r.migrationName),
  };
}
