import { afterEach, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { openBetterSqlite } from "$lib/shared/db/drivers/better-sqlite3";
import {
  PG_INT8_OID,
  createSqliteKysely,
  pgTypes,
  type AppDatabase,
} from "../kysely";
import { createPgliteDatabase } from "./pglite";

const open: AppDatabase[] = [];
afterEach(async () => {
  while (open.length) await open.pop()!.db.destroy();
});

describe("dialect factory", () => {
  it("SQLite: runs queries, foreign keys on", async () => {
    const app: AppDatabase = {
      kind: "sqlite",
      db: createSqliteKysely(openBetterSqlite(":memory:")),
    };
    open.push(app);
    const one = await sql<{ one: number }>`select 1 as one`.execute(app.db);
    expect(one.rows[0]!.one).toBe(1);
    const fk = await sql<{ foreign_keys: number }>`PRAGMA foreign_keys`.execute(
      app.db,
    );
    expect(fk.rows[0]!.foreign_keys).toBe(1);
  });

  it("Postgres (PGlite): runs queries; BIGINT comes back as a number", async () => {
    const app = createPgliteDatabase();
    open.push(app);
    const r = await sql<{
      ms: unknown;
    }>`select 1795299587815::bigint as ms`.execute(app.db);
    expect(r.rows[0]!.ms).toBe(1795299587815);
  });

  it("the pg pool's int8 parser returns numbers; other types keep pg defaults", () => {
    const parse = pgTypes.getTypeParser(PG_INT8_OID, "text") as (
      v: string,
    ) => unknown;
    expect(parse("1795299587815")).toBe(1795299587815);
    const bool = pgTypes.getTypeParser(16, "text") as (v: string) => unknown;
    expect(bool("t")).toBe(true);
  });
});
