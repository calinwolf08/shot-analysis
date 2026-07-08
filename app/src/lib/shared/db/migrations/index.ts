import type { Clock } from "../../utils";
import { systemClock } from "../../utils";
import type { DatabaseAdapter } from "../adapter";
import { initialSchema } from "./001-initial-schema";
import type { Migration } from "./types";

export type { Migration } from "./types";

/** All known migrations, ascending by version. */
export const ALL_MIGRATIONS: readonly Migration[] = [initialSchema];

export interface MigrateResult {
  /** Versions applied by this call (empty when already up to date). */
  applied: number[];
}

/**
 * Applies pending migrations, each inside its own transaction, and records
 * them in `schema_migrations`. Safe to call on every boot (idempotent).
 */
export async function migrate(
  db: DatabaseAdapter,
  migrations: readonly Migration[] = ALL_MIGRATIONS,
  clock: Clock = systemClock,
): Promise<MigrateResult> {
  assertOrdered(migrations);

  await db.run(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL
    )`,
  );

  const rows = await db.query<{ version: number }>(
    "SELECT version FROM schema_migrations ORDER BY version",
  );
  const appliedVersions = new Set(rows.map((r) => r.version));

  const applied: number[] = [];
  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) continue;
    await db.transaction(async (tx) => {
      for (const stmt of migration.up) {
        await tx.run(stmt);
      }
      await tx.run(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
        [migration.version, clock.now()],
      );
    });
    applied.push(migration.version);
  }
  return { applied };
}

function assertOrdered(migrations: readonly Migration[]): void {
  for (let i = 1; i < migrations.length; i++) {
    const prev = migrations[i - 1];
    const curr = migrations[i];
    if (prev && curr && curr.version <= prev.version) {
      throw new Error(
        `Migrations out of order: version ${curr.version} after ${prev.version}`,
      );
    }
  }
}
