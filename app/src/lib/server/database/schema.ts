/**
 * The app's tables as Kysely types (schema as of legacy migration 007 = the
 * `0001-baseline` Kysely migration). One schema for SQLite and Postgres:
 *  - ids and JSON payloads are TEXT;
 *  - booleans are INTEGER 0/1 (`toBool` / `fromBool` in repo-base);
 *  - timestamps are milliseconds since the epoch (INTEGER on SQLite, BIGINT on
 *    Postgres — parsed back to a JS number, see ./kysely).
 *
 * better-auth owns its own tables (`user`, `session`, `account`,
 * `verification`); they're not described here.
 *
 * Server-only.
 */

/** 0 | 1 */
type Flag = number;
/** Milliseconds since the epoch. */
type Millis = number;

export interface PlayersTable {
  id: string;
  name: string;
  shooting_hand: "left" | "right";
  level: string;
  created_at: Millis;
  updated_at: Millis;
  user_id: string | null;
}

export interface VideosTable {
  id: string;
  player_id: string;
  source: "upload" | "live";
  file_uri: string | null;
  duration_ms: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  created_at: Millis;
  user_id: string | null;
}

export interface SessionsTable {
  id: string;
  player_id: string;
  type: "assessment" | "live_practice";
  status: "in_progress" | "completed" | "aborted";
  plan_item_id: string | null;
  focus_metric: string | null;
  started_at: Millis;
  completed_at: Millis | null;
  notes: string | null;
  user_id: string | null;
}

export interface ShotsTable {
  id: string;
  player_id: string;
  session_id: string | null;
  video_id: string | null;
  shot_index: number;
  orientation: string | null;
  start_frame: number | null;
  end_frame: number | null;
  overall_confidence: number | null;
  excluded: Flag;
  analysis_json: string;
  created_at: Millis;
}

export interface ShotMetricsTable {
  shot_id: string;
  metric_name: string;
  value_num: number | null;
  value_text: string | null;
  unit: string | null;
  frame: number | null;
  confidence: number | null;
}

export interface ShotPosesTable {
  shot_id: string;
  poses_json: string;
}

export interface BenchmarksTable {
  id: string;
  name: string;
  version: number;
  is_placeholder: Flag;
  data_json: string;
  created_at: Millis;
}

export interface ScoresTable {
  id: string;
  scope: "shot" | "session";
  ref_id: string;
  benchmark_id: string;
  scoring_version: number;
  form_score: number | null;
  consistency_score: number | null;
  efficiency_score: number | null;
  overall_score: number | null;
  breakdown_json: string;
  created_at: Millis;
}

export interface FocusAreasTable {
  id: string;
  session_id: string;
  rank: number;
  issue_group: string;
  severity: number;
  metrics_json: string;
  created_at: Millis;
}

export interface DrillsTable {
  id: string;
  slug: string;
  version: number;
  is_placeholder: Flag;
  data_json: string;
}

export interface PlansTable {
  id: string;
  player_id: string;
  source_session_id: string;
  status: "active" | "completed" | "superseded";
  focus_json: string;
  created_at: Millis;
}

export interface PlanItemsTable {
  id: string;
  plan_id: string;
  day_index: number;
  position: number;
  type: "drill" | "live_practice" | "reassessment";
  drill_id: string | null;
  focus_metric: string | null;
  target_reps: number | null;
  status: "pending" | "done" | "skipped";
  completed_at: Millis | null;
}

export interface RepsTable {
  id: string;
  session_id: string;
  rep_index: number;
  shot_id: string | null;
  rep_score: number | null;
  primary_cue: string | null;
  feedback_json: string | null;
  created_at: Millis;
}

/** Legacy global settings (kept; the server uses user_settings). */
export interface SettingsTable {
  key: string;
  value: string;
}

export interface UserSettingsTable {
  user_id: string;
  key: string;
  value: string;
}

export interface Database {
  players: PlayersTable;
  videos: VideosTable;
  sessions: SessionsTable;
  shots: ShotsTable;
  shot_metrics: ShotMetricsTable;
  shot_poses: ShotPosesTable;
  benchmarks: BenchmarksTable;
  scores: ScoresTable;
  focus_areas: FocusAreasTable;
  drills: DrillsTable;
  plans: PlansTable;
  plan_items: PlanItemsTable;
  reps: RepsTable;
  settings: SettingsTable;
  user_settings: UserSettingsTable;
}

/** Every app table, in foreign-key-safe creation order. */
export const APP_TABLES = [
  "players",
  "videos",
  "sessions",
  "shots",
  "shot_metrics",
  "benchmarks",
  "scores",
  "focus_areas",
  "drills",
  "plans",
  "plan_items",
  "reps",
  "settings",
  "shot_poses",
  "user_settings",
] as const satisfies readonly (keyof Database)[];
