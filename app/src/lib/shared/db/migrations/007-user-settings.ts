import type { Migration } from "./types";

/**
 * Per-user settings on the server. Until now the server kept ONE `settings`
 * row per key for every account, so one user choosing a focus area (or
 * turning voice off) changed it for everyone.
 *
 * `user_settings` is keyed by (user_id, key). Existing global values are
 * copied to every known user (anyone who owns a player, session or video), so
 * nobody's current choices reset. New users start from the defaults.
 *
 * The old `settings` table is kept: the on-device database (single user, no
 * accounts) still uses it, and it stays as a record of the pre-migration
 * values.
 */
const USERS = `SELECT user_id FROM players WHERE user_id IS NOT NULL
  UNION SELECT user_id FROM sessions WHERE user_id IS NOT NULL
  UNION SELECT user_id FROM videos WHERE user_id IS NOT NULL`;

export const userSettings: Migration = {
  version: 7,
  name: "user-settings",
  up: [
    `CREATE TABLE user_settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    )`,
    `INSERT INTO user_settings (user_id, key, value)
      SELECT u.user_id, s.key, s.value FROM (${USERS}) u CROSS JOIN settings s`,
  ],
};
