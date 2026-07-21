import type { Migration } from "./types";

/**
 * Server-side user scoping. `players.user_id` (migration 002) is the ownership
 * root; `sessions` and `videos` are the direct entry points the API queries, so
 * they carry `user_id` redundantly (indexed) to avoid a join on hot paths.
 * Deeper tables (shots, shot_metrics, scores, reps, focus_areas) are scoped by
 * joining up to their owning session/player.
 */
export const userScopeSessionsVideos: Migration = {
  version: 3,
  name: "user-scope-sessions-videos",
  up: [
    "ALTER TABLE sessions ADD COLUMN user_id TEXT",
    "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)",
    "ALTER TABLE videos ADD COLUMN user_id TEXT",
    "CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos (user_id)",
  ],
};
