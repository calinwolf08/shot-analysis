import type { Migration } from "./types";

/**
 * De-session the live model (live-first redesign — Milestone 1, step 3).
 *
 * A shot becomes the unit of record, rooted directly on the player with its
 * `created_at` timestamp — live practice no longer creates a `session`. The
 * `shots` table is rebuilt to:
 *   - add `player_id` (NOT NULL), backfilled from the owning session,
 *   - make `session_id` NULLABLE (live shots have no session; the hidden
 *     assessment path still sets it),
 * and gains `idx_shots_player (player_id, created_at)` for the Shots/Insights
 * reads. Ownership scoping moves from "join up to the session" to "join up to
 * the player" (players.user_id is the root), which works for both session-less
 * live shots and session-backed assessment shots.
 *
 * `sessions` and the rest of the assessment schema are left intact (kept as
 * dead storage for the hidden upload path — see docs/live-redesign-plan.md §1).
 *
 * SQLite can't drop a column's NOT NULL in place, so this is the standard
 * table rebuild. `foreign_keys` is ON for the connection and can't be toggled
 * mid-transaction, so `defer_foreign_keys` holds enforcement until COMMIT: the
 * rebuild preserves every shot id, so `reps.shot_id` / `shot_metrics.shot_id`
 * still resolve, and `player_id`/`session_id` reference live rows, so all
 * constraints hold at commit time.
 */
export const shotsPlayerRoot: Migration = {
  version: 4,
  name: "shots-player-root",
  up: [
    "PRAGMA defer_foreign_keys = ON",

    `CREATE TABLE shots_new (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(id),
      session_id TEXT REFERENCES sessions(id),
      video_id TEXT REFERENCES videos(id),
      shot_index INTEGER NOT NULL, orientation TEXT,
      start_frame INTEGER, end_frame INTEGER, overall_confidence REAL,
      excluded INTEGER NOT NULL DEFAULT 0,
      analysis_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,

    // Backfill player_id from each shot's owning session. Shots with no valid
    // session are dropped (there should be none — session_id was NOT NULL).
    `INSERT INTO shots_new (id, player_id, session_id, video_id, shot_index,
        orientation, start_frame, end_frame, overall_confidence, excluded,
        analysis_json, created_at)
      SELECT s.id, se.player_id, s.session_id, s.video_id, s.shot_index,
        s.orientation, s.start_frame, s.end_frame, s.overall_confidence,
        s.excluded, s.analysis_json, s.created_at
      FROM shots s JOIN sessions se ON s.session_id = se.id`,

    "DROP TABLE shots",
    "ALTER TABLE shots_new RENAME TO shots",

    "CREATE INDEX idx_shots_session ON shots(session_id, shot_index)",
    "CREATE INDEX idx_shots_player ON shots(player_id, created_at)",
  ],
};
