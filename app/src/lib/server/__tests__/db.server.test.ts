import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbSingletonForTests, databasePath } from "../db";

describe("server db singleton", () => {
  let prevPath: string | undefined;

  beforeEach(() => {
    prevPath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = ":memory:";
    resetDbSingletonForTests();
  });

  afterEach(() => {
    if (prevPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = prevPath;
    resetDbSingletonForTests();
  });

  it("reads the path from the environment", () => {
    expect(databasePath()).toBe(":memory:");
  });

  it("returns the same instance across calls (singleton)", async () => {
    const a = await getDb();
    const b = await getDb();
    expect(a).toBe(b);
  });

  it("opens, migrates, and answers a trivial query", async () => {
    const db = await getDb();
    const rows = await db.query<{ one: number }>("SELECT 1 AS one");
    expect(rows[0]?.one).toBe(1);
  });

  it("has applied the schema migrations (core tables exist)", async () => {
    const db = await getDb();
    const rows = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const tables = new Set(rows.map((r) => r.name));
    for (const t of [
      "schema_migrations",
      "players",
      "sessions",
      "shots",
      "scores",
      "settings",
    ]) {
      expect(tables.has(t)).toBe(true);
    }
  });

  it("recovers the singleton after a reset", async () => {
    const first = await getDb();
    resetDbSingletonForTests();
    const second = await getDb();
    expect(second).not.toBe(first);
    const rows = await second.query<{ one: number }>("SELECT 1 AS one");
    expect(rows[0]?.one).toBe(1);
  });
});
