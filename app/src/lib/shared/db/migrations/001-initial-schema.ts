import type { Migration } from "./types";

/**
 * Schema v1 — verbatim from docs/design-training-app.md §Data Model.
 * `schema_migrations` itself is created by the migration runner.
 */
export const initialSchema: Migration = {
  version: 1,
  name: "initial-schema",
  up: [
    `CREATE TABLE players (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      shooting_hand TEXT NOT NULL CHECK (shooting_hand IN ('left','right')),
      level TEXT NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`,

    `CREATE TABLE videos (
      id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
      source TEXT NOT NULL CHECK (source IN ('upload','live')),
      file_uri TEXT, duration_ms INTEGER, fps REAL, width INTEGER, height INTEGER,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX idx_videos_player ON videos(player_id)`,

    `CREATE TABLE sessions (
      id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
      type TEXT NOT NULL CHECK (type IN ('assessment','live_practice')),
      status TEXT NOT NULL CHECK (status IN ('in_progress','completed','aborted')),
      plan_item_id TEXT REFERENCES plan_items(id),
      focus_metric TEXT, started_at INTEGER NOT NULL, completed_at INTEGER, notes TEXT
    )`,
    `CREATE INDEX idx_sessions_player ON sessions(player_id, started_at)`,

    `CREATE TABLE shots (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
      video_id TEXT REFERENCES videos(id),
      shot_index INTEGER NOT NULL, orientation TEXT,
      start_frame INTEGER, end_frame INTEGER, overall_confidence REAL,
      excluded INTEGER NOT NULL DEFAULT 0,
      analysis_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX idx_shots_session ON shots(session_id, shot_index)`,

    `CREATE TABLE shot_metrics (
      shot_id TEXT NOT NULL REFERENCES shots(id),
      metric_name TEXT NOT NULL,
      value_num REAL, value_text TEXT, unit TEXT, frame INTEGER, confidence REAL,
      PRIMARY KEY (shot_id, metric_name)
    )`,
    `CREATE INDEX idx_shot_metrics_name ON shot_metrics(metric_name)`,

    `CREATE TABLE benchmarks (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL,
      is_placeholder INTEGER NOT NULL, data_json TEXT NOT NULL, created_at INTEGER NOT NULL
    )`,

    `CREATE TABLE scores (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL CHECK (scope IN ('shot','session')),
      ref_id TEXT NOT NULL,
      benchmark_id TEXT NOT NULL REFERENCES benchmarks(id),
      scoring_version INTEGER NOT NULL,
      form_score REAL, consistency_score REAL, efficiency_score REAL, overall_score REAL,
      breakdown_json TEXT NOT NULL, created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX idx_scores_ref ON scores(scope, ref_id)`,

    `CREATE TABLE focus_areas (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
      rank INTEGER NOT NULL, issue_group TEXT NOT NULL, severity REAL NOT NULL,
      metrics_json TEXT NOT NULL, created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX idx_focus_areas_session ON focus_areas(session_id, rank)`,

    `CREATE TABLE drills (
      id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, version INTEGER NOT NULL,
      is_placeholder INTEGER NOT NULL, data_json TEXT NOT NULL
    )`,

    `CREATE TABLE plans (
      id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
      source_session_id TEXT NOT NULL REFERENCES sessions(id),
      status TEXT NOT NULL CHECK (status IN ('active','completed','superseded')),
      focus_json TEXT NOT NULL, created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX idx_plans_player ON plans(player_id, status)`,

    `CREATE TABLE plan_items (
      id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id),
      day_index INTEGER NOT NULL, position INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('drill','live_practice','reassessment')),
      drill_id TEXT REFERENCES drills(id),
      focus_metric TEXT, target_reps INTEGER,
      status TEXT NOT NULL CHECK (status IN ('pending','done','skipped')),
      completed_at INTEGER
    )`,
    `CREATE INDEX idx_plan_items_plan ON plan_items(plan_id, day_index, position)`,

    `CREATE TABLE reps (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
      rep_index INTEGER NOT NULL, shot_id TEXT REFERENCES shots(id),
      rep_score REAL, primary_cue TEXT, feedback_json TEXT, created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX idx_reps_session ON reps(session_id, rep_index)`,

    `CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  ],
};
