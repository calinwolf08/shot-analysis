import { afterEach, describe, expect, it } from "vitest";
import { createFakeClock } from "../../utils";
import type { DatabaseAdapter } from "../adapter";
import { createBetterSqliteAdapter } from "../drivers/better-sqlite3";
import { ALL_MIGRATIONS, migrate, type Migration } from "../migrations";

/** Every table schema v1 must create, with a few spot-check columns. */
const EXPECTED_TABLES: Record<string, string[]> = {
  players: ["id", "name", "shooting_hand", "level", "created_at", "updated_at"],
  videos: ["id", "player_id", "source", "file_uri", "fps"],
  sessions: [
    "id",
    "player_id",
    "type",
    "status",
    "plan_item_id",
    "focus_metric",
  ],
  shots: ["id", "session_id", "shot_index", "excluded", "analysis_json"],
  shot_metrics: [
    "shot_id",
    "metric_name",
    "value_num",
    "value_text",
    "confidence",
  ],
  benchmarks: ["id", "name", "version", "is_placeholder", "data_json"],
  scores: [
    "id",
    "scope",
    "ref_id",
    "benchmark_id",
    "scoring_version",
    "breakdown_json",
  ],
  focus_areas: [
    "id",
    "session_id",
    "rank",
    "issue_group",
    "severity",
    "metrics_json",
  ],
  drills: ["id", "slug", "version", "is_placeholder", "data_json"],
  plans: ["id", "player_id", "source_session_id", "status", "focus_json"],
  plan_items: [
    "id",
    "plan_id",
    "day_index",
    "position",
    "type",
    "drill_id",
    "status",
  ],
  reps: [
    "id",
    "session_id",
    "rep_index",
    "shot_id",
    "rep_score",
    "primary_cue",
  ],
  settings: ["key", "value"],
  schema_migrations: ["version", "applied_at"],
};

describe("migrate", () => {
  let db: DatabaseAdapter;

  afterEach(async () => {
    await db.close();
  });

  it("applies all migrations from empty and creates every schema v1 table", async () => {
    db = createBetterSqliteAdapter();
    const result = await migrate(db);
    expect(result.applied).toEqual(ALL_MIGRATIONS.map((m) => m.version));

    for (const [table, expectedCols] of Object.entries(EXPECTED_TABLES)) {
      const info = await db.query<{ name: string }>(
        `PRAGMA table_info(${table})`,
      );
      const cols = info.map((c) => c.name);
      expect(cols.length, `table ${table} missing`).toBeGreaterThan(0);
      for (const col of expectedCols) {
        expect(cols, `${table}.${col}`).toContain(col);
      }
    }
  });

  it("is idempotent: a second run applies nothing", async () => {
    db = createBetterSqliteAdapter();
    await migrate(db);
    const second = await migrate(db);
    expect(second.applied).toEqual([]);
    const rows = await db.query("SELECT * FROM schema_migrations");
    expect(rows).toHaveLength(ALL_MIGRATIONS.length);
  });

  it("records applied_at from the injected clock", async () => {
    db = createBetterSqliteAdapter();
    const clock = createFakeClock(1234567);
    await migrate(db, ALL_MIGRATIONS, clock);
    const rows = await db.query<{ applied_at: number }>(
      "SELECT applied_at FROM schema_migrations",
    );
    expect(rows[0]!.applied_at).toBe(1234567);
  });

  it("rolls back a partially-failing migration atomically", async () => {
    db = createBetterSqliteAdapter();
    const bad: Migration = {
      version: 99,
      name: "bad-migration",
      up: [
        "CREATE TABLE will_be_rolled_back (id TEXT)",
        "THIS IS NOT VALID SQL",
      ],
    };
    await expect(migrate(db, [...ALL_MIGRATIONS, bad])).rejects.toThrow();

    // The bad migration's first statement must not have survived…
    const t = await db.query("PRAGMA table_info(will_be_rolled_back)");
    expect(t).toHaveLength(0);
    // …and it must not be recorded as applied.
    const versions = await db.query<{ version: number }>(
      "SELECT version FROM schema_migrations",
    );
    expect(versions.map((v) => v.version)).not.toContain(99);
    // Earlier migrations stay applied.
    expect(versions.map((v) => v.version)).toEqual(
      ALL_MIGRATIONS.map((m) => m.version),
    );
  });

  it("rejects out-of-order migration lists", async () => {
    db = createBetterSqliteAdapter();
    const m1: Migration = { version: 2, name: "a", up: [] };
    const m2: Migration = { version: 1, name: "b", up: [] };
    await expect(migrate(db, [m1, m2])).rejects.toThrow(/out of order/i);
  });

  it("resumes after a failed migration once it is fixed", async () => {
    db = createBetterSqliteAdapter();
    const bad: Migration = {
      version: 99,
      name: "bad",
      up: ["NOT SQL AT ALL"],
    };
    await expect(migrate(db, [...ALL_MIGRATIONS, bad])).rejects.toThrow();

    const fixed: Migration = {
      version: 99,
      name: "fixed",
      up: ["CREATE TABLE recovered (id TEXT)"],
    };
    const result = await migrate(db, [...ALL_MIGRATIONS, fixed]);
    expect(result.applied).toEqual([99]);
    const t = await db.query("PRAGMA table_info(recovered)");
    expect(t.length).toBeGreaterThan(0);
  });
});
