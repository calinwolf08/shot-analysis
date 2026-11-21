/**
 * Test-only: an in-process Postgres (PGlite) behind the same Kysely types,
 * with int8 parsed to a number like the real pg pool (../kysely pgTypes).
 */
import { PGlite } from "@electric-sql/pglite";
import { Kysely } from "kysely";
import { PGliteDialect } from "kysely-pglite-dialect";
import type { AppDatabase } from "../kysely";
import { PG_INT8_OID } from "../kysely";
import type { Database } from "../schema";

export function createPgliteDatabase(): AppDatabase {
  const pg = new PGlite({
    parsers: { [PG_INT8_OID]: (v: string) => Number(v) },
  });
  return {
    kind: "postgres",
    db: new Kysely<Database>({ dialect: new PGliteDialect(pg) }),
  };
}
