/**
 * Kysely migration 0001 — the baseline: the whole schema as it stands after
 * legacy migration 007, built with Kysely's schema builder so it runs on
 * SQLite and Postgres alike.
 *
 *  - An existing SQLite database is first brought to legacy version 7 by the
 *    old runner (see ../migrate), so its tables already exist: this migration
 *    then does nothing but be recorded.
 *  - A fresh database (either kind) gets every table + index here. On SQLite
 *    the legacy `schema_migrations` rows 1–7 are written too, so rolling back
 *    to a release that still uses the legacy runner finds the schema current
 *    and doesn't try to create tables that exist.
 *
 * Portable types: TEXT ids/JSON, INTEGER 0/1 flags, ms timestamps as INTEGER
 * (SQLite) / BIGINT (Postgres), floats as REAL / DOUBLE PRECISION.
 * Postgres can't reference a table before it exists, so the
 * sessions → plan_items foreign key is added after plan_items there (SQLite
 * accepts the forward reference inline, as the legacy schema did).
 */
import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import type { DbKind } from "../config";

/** Legacy migration versions a fresh SQLite baseline stands in for. */
export const LEGACY_VERSIONS_COVERED = [1, 2, 3, 4, 5, 6, 7] as const;

export function baselineMigration(kind: DbKind): Migration {
  const pg = kind === "postgres";
  const ts = pg ? "bigint" : "integer";
  const float = pg ? "double precision" : "real";

  return {
    async up(db: Kysely<unknown>): Promise<void> {
      // Already there (upgraded legacy SQLite)? Checked in the CURRENT
      // schema only — a Postgres server may hold other schemas with their own
      // `players` table (other apps, parallel test schemas).
      const found = pg
        ? await sql<{
            t: string | null;
          }>`SELECT to_regclass('players')::text AS t`.execute(db)
        : await sql<{ t: string | null }>`SELECT name AS t FROM sqlite_master
            WHERE type = 'table' AND name = 'players'`.execute(db);
      if (found.rows[0]?.t) return; // upgraded legacy database

      await db.schema
        .createTable("players")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("name", "text", (c) => c.notNull())
        .addColumn("shooting_hand", "text", (c) =>
          c.notNull().check(sql`shooting_hand IN ('left','right')`),
        )
        .addColumn("level", "text", (c) => c.notNull())
        .addColumn("created_at", ts, (c) => c.notNull())
        .addColumn("updated_at", ts, (c) => c.notNull())
        .addColumn("user_id", "text")
        .execute();

      await db.schema
        .createTable("videos")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("player_id", "text", (c) =>
          c.notNull().references("players.id"),
        )
        .addColumn("source", "text", (c) =>
          c.notNull().check(sql`source IN ('upload','live')`),
        )
        .addColumn("file_uri", "text")
        .addColumn("duration_ms", "integer")
        .addColumn("fps", float)
        .addColumn("width", "integer")
        .addColumn("height", "integer")
        .addColumn("created_at", ts, (c) => c.notNull())
        .addColumn("user_id", "text")
        .execute();

      await db.schema
        .createTable("sessions")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("player_id", "text", (c) =>
          c.notNull().references("players.id"),
        )
        .addColumn("type", "text", (c) =>
          c.notNull().check(sql`type IN ('assessment','live_practice')`),
        )
        .addColumn("status", "text", (c) =>
          c
            .notNull()
            .check(sql`status IN ('in_progress','completed','aborted')`),
        )
        .addColumn("plan_item_id", "text", (c) =>
          pg ? c : c.references("plan_items.id"),
        )
        .addColumn("focus_metric", "text")
        .addColumn("started_at", ts, (c) => c.notNull())
        .addColumn("completed_at", ts)
        .addColumn("notes", "text")
        .addColumn("user_id", "text")
        .execute();

      await db.schema
        .createTable("shots")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("player_id", "text", (c) =>
          c.notNull().references("players.id"),
        )
        .addColumn("session_id", "text", (c) => c.references("sessions.id"))
        .addColumn("video_id", "text", (c) => c.references("videos.id"))
        .addColumn("shot_index", "integer", (c) => c.notNull())
        .addColumn("orientation", "text")
        .addColumn("start_frame", "integer")
        .addColumn("end_frame", "integer")
        .addColumn("overall_confidence", float)
        .addColumn("excluded", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("analysis_json", "text", (c) => c.notNull())
        .addColumn("created_at", ts, (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("shot_metrics")
        .addColumn("shot_id", "text", (c) => c.notNull().references("shots.id"))
        .addColumn("metric_name", "text", (c) => c.notNull())
        .addColumn("value_num", float)
        .addColumn("value_text", "text")
        .addColumn("unit", "text")
        .addColumn("frame", "integer")
        .addColumn("confidence", float)
        .addPrimaryKeyConstraint("shot_metrics_pk", ["shot_id", "metric_name"])
        .execute();

      await db.schema
        .createTable("benchmarks")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("name", "text", (c) => c.notNull())
        .addColumn("version", "integer", (c) => c.notNull())
        .addColumn("is_placeholder", "integer", (c) => c.notNull())
        .addColumn("data_json", "text", (c) => c.notNull())
        .addColumn("created_at", ts, (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("scores")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("scope", "text", (c) =>
          c.notNull().check(sql`scope IN ('shot','session')`),
        )
        .addColumn("ref_id", "text", (c) => c.notNull())
        .addColumn("benchmark_id", "text", (c) =>
          c.notNull().references("benchmarks.id"),
        )
        .addColumn("scoring_version", "integer", (c) => c.notNull())
        .addColumn("form_score", float)
        .addColumn("consistency_score", float)
        .addColumn("efficiency_score", float)
        .addColumn("overall_score", float)
        .addColumn("breakdown_json", "text", (c) => c.notNull())
        .addColumn("created_at", ts, (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("focus_areas")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("session_id", "text", (c) =>
          c.notNull().references("sessions.id"),
        )
        .addColumn("rank", "integer", (c) => c.notNull())
        .addColumn("issue_group", "text", (c) => c.notNull())
        .addColumn("severity", float, (c) => c.notNull())
        .addColumn("metrics_json", "text", (c) => c.notNull())
        .addColumn("created_at", ts, (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("drills")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("slug", "text", (c) => c.unique().notNull())
        .addColumn("version", "integer", (c) => c.notNull())
        .addColumn("is_placeholder", "integer", (c) => c.notNull())
        .addColumn("data_json", "text", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("plans")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("player_id", "text", (c) =>
          c.notNull().references("players.id"),
        )
        .addColumn("source_session_id", "text", (c) =>
          c.notNull().references("sessions.id"),
        )
        .addColumn("status", "text", (c) =>
          c.notNull().check(sql`status IN ('active','completed','superseded')`),
        )
        .addColumn("focus_json", "text", (c) => c.notNull())
        .addColumn("created_at", ts, (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("plan_items")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("plan_id", "text", (c) => c.notNull().references("plans.id"))
        .addColumn("day_index", "integer", (c) => c.notNull())
        .addColumn("position", "integer", (c) => c.notNull())
        .addColumn("type", "text", (c) =>
          c
            .notNull()
            .check(sql`type IN ('drill','live_practice','reassessment')`),
        )
        .addColumn("drill_id", "text", (c) => c.references("drills.id"))
        .addColumn("focus_metric", "text")
        .addColumn("target_reps", "integer")
        .addColumn("status", "text", (c) =>
          c.notNull().check(sql`status IN ('pending','done','skipped')`),
        )
        .addColumn("completed_at", ts)
        .execute();

      if (pg) {
        await db.schema
          .alterTable("sessions")
          .addForeignKeyConstraint(
            "sessions_plan_item_id_fkey",
            ["plan_item_id"],
            "plan_items",
            ["id"],
          )
          .execute();
      }

      await db.schema
        .createTable("reps")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("session_id", "text", (c) =>
          c.notNull().references("sessions.id"),
        )
        .addColumn("rep_index", "integer", (c) => c.notNull())
        .addColumn("shot_id", "text", (c) => c.references("shots.id"))
        .addColumn("rep_score", float)
        .addColumn("primary_cue", "text")
        .addColumn("feedback_json", "text")
        .addColumn("created_at", ts, (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("settings")
        .addColumn("key", "text", (c) => c.primaryKey())
        .addColumn("value", "text", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("shot_poses")
        .addColumn("shot_id", "text", (c) =>
          c.primaryKey().references("shots.id"),
        )
        .addColumn("poses_json", "text", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("user_settings")
        .addColumn("user_id", "text", (c) => c.notNull())
        .addColumn("key", "text", (c) => c.notNull())
        .addColumn("value", "text", (c) => c.notNull())
        .addPrimaryKeyConstraint("user_settings_pk", ["user_id", "key"])
        .execute();

      const indexes: [string, string, string[]][] = [
        ["idx_videos_player", "videos", ["player_id"]],
        ["idx_sessions_player", "sessions", ["player_id", "started_at"]],
        ["idx_shots_session", "shots", ["session_id", "shot_index"]],
        ["idx_shots_player", "shots", ["player_id", "created_at"]],
        ["idx_shot_metrics_name", "shot_metrics", ["metric_name"]],
        ["idx_scores_ref", "scores", ["scope", "ref_id"]],
        ["idx_focus_areas_session", "focus_areas", ["session_id", "rank"]],
        ["idx_plans_player", "plans", ["player_id", "status"]],
        [
          "idx_plan_items_plan",
          "plan_items",
          ["plan_id", "day_index", "position"],
        ],
        ["idx_reps_session", "reps", ["session_id", "rep_index"]],
        ["idx_players_user_id", "players", ["user_id"]],
        ["idx_sessions_user_id", "sessions", ["user_id"]],
        ["idx_videos_user_id", "videos", ["user_id"]],
      ];
      for (const [name, table, columns] of indexes) {
        await db.schema.createIndex(name).on(table).columns(columns).execute();
      }

      if (!pg) {
        // Keep the legacy runner's bookkeeping current (rollback safety).
        await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL
        )`.execute(db);
        const now = Date.now();
        for (const v of LEGACY_VERSIONS_COVERED) {
          await sql`INSERT OR IGNORE INTO schema_migrations (version, applied_at)
            VALUES (${v}, ${now})`.execute(db);
        }
      }
    },
  };
}
