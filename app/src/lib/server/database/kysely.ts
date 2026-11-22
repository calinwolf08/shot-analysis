/**
 * Kysely instances over SQLite (better-sqlite3) or Postgres (pg), typed with
 * the app schema. Which one the server uses comes from ./config.
 *
 * Postgres returns BIGINT (int8) and NUMERIC as strings by default; the app
 * stores millisecond timestamps in BIGINT and aggregates (COUNT / SUM / AVG)
 * come back as those types, so both are parsed to a JS number (safe: ms
 * timestamps and counts are far below 2^53; averages are display values).
 * Set per pool — no global pg state.
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

/** OID of Postgres int8 / BIGINT (ms timestamps, COUNT, SUM of integers). */
export const PG_INT8_OID = 20;
/** OID of Postgres numeric (what AVG returns). */
export const PG_NUMERIC_OID = 1700;
/** Types parsed to a JS number instead of pg's default string. */
export const PG_NUMBER_OIDS: readonly number[] = [PG_INT8_OID, PG_NUMERIC_OID];
/** Parser for those (null stays null; pg only calls it for non-null values). */
export const parsePgNumber = (v: string): number => Number(v);

/** pg type parsers with int8 → number; everything else as pg defaults. */
export const pgTypes: pg.CustomTypesConfig = {
  getTypeParser: ((oid: number, format?: "text" | "binary") =>
    PG_NUMBER_OIDS.includes(oid)
      ? parsePgNumber
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
