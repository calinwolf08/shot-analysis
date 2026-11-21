/**
 * Kysely instances over SQLite (better-sqlite3) or Postgres (pg), typed with
 * the app schema. Which one the server uses comes from ./config.
 *
 * Postgres returns BIGINT (int8) as a string by default; the app stores
 * millisecond timestamps there, so int8 is parsed to a JS number (safe: ms
 * timestamps are far below 2^53). Set per pool — no global pg state.
 *
 * Server-only.
 */
import type BetterSqlite3 from "better-sqlite3";
import { Kysely, PostgresDialect, SqliteDialect } from "kysely";
import pg from "pg";
import type { DbKind } from "./config";
import type { Database } from "./schema";

export type AppKysely = Kysely<Database>;

/** A Kysely instance plus which database it talks to. */
export interface AppDatabase {
  readonly kind: DbKind;
  readonly db: AppKysely;
}

/**
 * Kysely over an open better-sqlite3 connection (see `openBetterSqlite`, which
 * sets WAL + foreign keys). Destroying the Kysely instance closes it.
 */
export function createSqliteKysely(
  database: BetterSqlite3.Database,
): AppKysely {
  return new Kysely<Database>({ dialect: new SqliteDialect({ database }) });
}

/** OID of Postgres int8 / BIGINT. */
export const PG_INT8_OID = 20;

/** pg type parsers with int8 → number; everything else as pg defaults. */
export const pgTypes: pg.CustomTypesConfig = {
  getTypeParser: ((oid: number, format?: "text" | "binary") =>
    oid === PG_INT8_OID
      ? (v: string) => Number(v)
      : pg.types.getTypeParser(
          oid,
          format,
        )) as pg.CustomTypesConfig["getTypeParser"],
};

export function createPostgresKysely(
  url: string,
  pool: Omit<pg.PoolConfig, "connectionString" | "types"> = {},
): AppKysely {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ ...pool, connectionString: url, types: pgTypes }),
    }),
  });
}
