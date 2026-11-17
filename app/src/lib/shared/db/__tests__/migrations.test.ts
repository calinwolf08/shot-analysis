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
  shots: [
    "id",
    "player_id",
    "session_id",
    "shot_index",
    "excluded",
    "analysis_json",
  ],
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
  shot_poses: ["shot_id", "poses_json"],
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

  it("004 backfills shots.player_id from the session and allows null session_id", async () => {
    db = createBetterSqliteAdapter();
    // Migrate only up to v3, then seed a session-rooted shot the old way.
    const upToV3 = ALL_MIGRATIONS.filter((m) => m.version <= 3);
    await migrate(db, upToV3);
    await db.run(
      `INSERT INTO players (id, name, shooting_hand, level, created_at, updated_at, user_id)
       VALUES ('p1', 'A', 'right', 'youth', 0, 0, 'u1')`,
    );
    await db.run(
      `INSERT INTO sessions (id, player_id, type, status, started_at, user_id)
       VALUES ('sess1', 'p1', 'assessment', 'completed', 0, 'u1')`,
    );
    await db.run(
      `INSERT INTO shots (id, session_id, shot_index, excluded, analysis_json, created_at)
       VALUES ('shot1', 'sess1', 0, 0, '{}', 100)`,
    );

    // Apply v4 (de-sessions shots) and v5 (adds shot_poses).
    const result = await migrate(
      db,
      ALL_MIGRATIONS.filter((m) => m.version <= 5),
    );
    expect(result.applied).toEqual([4, 5]);

    const [row] = await db.query<{ player_id: string; session_id: string }>(
      "SELECT player_id, session_id FROM shots WHERE id = 'shot1'",
    );
    expect(row?.player_id).toBe("p1"); // backfilled from the session
    expect(row?.session_id).toBe("sess1"); // preserved

    // A session-less live shot is now allowed…
    await db.run(
      `INSERT INTO shots (id, player_id, shot_index, excluded, analysis_json, created_at)
       VALUES ('shot2', 'p1', 0, 0, '{}', 200)`,
    );
    const [live] = await db.query<{ session_id: string | null }>(
      "SELECT session_id FROM shots WHERE id = 'shot2'",
    );
    expect(live?.session_id).toBeNull();

    // …but player_id is required.
    await expect(
      db.run(
        `INSERT INTO shots (id, shot_index, excluded, analysis_json, created_at)
         VALUES ('shot3', 0, 0, '{}', 300)`,
      ),
    ).rejects.toThrow();
  });

  it("006 deletes shots not taken from the shooting-arm side, with dependents", async () => {
    db = createBetterSqliteAdapter();
    await migrate(
      db,
      ALL_MIGRATIONS.filter((m) => m.version <= 5),
    );
    await db.run(
      `INSERT INTO players (id, name, shooting_hand, level, created_at, updated_at, user_id) VALUES
       ('pr', 'Righty', 'right', 'youth', 0, 0, 'u1'),
       ('pl', 'Lefty', 'left', 'youth', 0, 0, 'u1')`,
    );
    await db.run(
      `INSERT INTO sessions (id, player_id, type, status, started_at, user_id)
       VALUES ('sess1', 'pr', 'assessment', 'completed', 0, 'u1')`,
    );
    const shots: [string, string, string | null, string | null][] = [
      // id, player, orientation, session
      ["r-keep", "pr", "side-right", null],
      ["r-guide", "pr", "side-left", null],
      ["r-front", "pr", "front-right", null],
      ["r-unknown", "pr", "unknown", null],
      ["r-null", "pr", null, null],
      ["r-assess-keep", "pr", "side-right", "sess1"],
      ["r-assess-drop", "pr", "behind", "sess1"],
      ["l-keep", "pl", "side-left", null],
      ["l-drop", "pl", "side-right", null],
    ];
    for (const [id, player, orientation, session] of shots) {
      await db.run(
        `INSERT INTO shots (id, player_id, session_id, shot_index, orientation, excluded, analysis_json, created_at)
         VALUES (?, ?, ?, 0, ?, 0, '{}', 0)`,
        [id, player, session, orientation],
      );
      await db.run(
        "INSERT INTO shot_poses (shot_id, poses_json) VALUES (?, '{}')",
        [id],
      );
      await db.run(
        "INSERT INTO shot_metrics (shot_id, metric_name, value_num) VALUES (?, 'm', 1)",
        [id],
      );
    }
    await db.run(
      `INSERT INTO benchmarks (id, name, version, is_placeholder, data_json, created_at)
       VALUES ('b1', 'B', 1, 1, '{}', 0)`,
    );
    for (const id of ["r-keep", "r-front"]) {
      await db.run(
        `INSERT INTO scores (id, scope, ref_id, benchmark_id, scoring_version, breakdown_json, created_at)
         VALUES (?, 'shot', ?, 'b1', 1, '{}', 0)`,
        [`score-${id}`, id],
      );
    }
    await db.run(
      `INSERT INTO reps (id, session_id, rep_index, shot_id, created_at)
       VALUES ('rep1', 'sess1', 0, 'r-assess-drop', 0)`,
    );

    const result = await migrate(db);
    expect(result.applied).toEqual([6]);

    const ids = (
      await db.query<{ id: string }>("SELECT id FROM shots ORDER BY id")
    ).map((r) => r.id);
    expect(ids).toEqual(["l-keep", "r-assess-keep", "r-keep"]);
    const left = async (sql: string) =>
      (await db.query<{ id: string }>(sql)).map((r) => r.id).sort();
    expect(await left("SELECT shot_id AS id FROM shot_poses")).toEqual(ids);
    expect(await left("SELECT shot_id AS id FROM shot_metrics")).toEqual(ids);
    expect(await left("SELECT ref_id AS id FROM scores")).toEqual(["r-keep"]);
    const [rep] = await db.query<{ shot_id: string | null }>(
      "SELECT shot_id FROM reps WHERE id = 'rep1'",
    );
    expect(rep?.shot_id).toBeNull(); // rep kept, unlinked
    // Foreign keys all still resolve.
    expect(await db.query("PRAGMA foreign_key_check")).toEqual([]);
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
