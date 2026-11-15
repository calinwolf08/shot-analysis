import type { Migration } from "./types";

/**
 * Auth data scoping: players belong to an authenticated user. Legacy rows
 * (created before auth existed) keep user_id NULL until the first
 * signed-in user claims them (PlayerRepo.claimUnowned).
 */
export const playerUserScope: Migration = {
  version: 2,
  name: "player-user-scope",
  up: [
    "ALTER TABLE players ADD COLUMN user_id TEXT",
    "CREATE INDEX IF NOT EXISTS idx_players_user_id ON players (user_id)",
  ],
};
