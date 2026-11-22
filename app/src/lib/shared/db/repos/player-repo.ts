/**
 * Repository contract (implemented on the server with Kysely —
 * lib/server/repos.ts; the browser uses the API-backed remote repos).
 */
import type { Player, PlayerLevel, ShootingHand } from "./types";

export interface CreatePlayerInput {
  name: string;
  shootingHand: ShootingHand;
  level: PlayerLevel;
}

export interface PlayerRepo {
  create(input: CreatePlayerInput): Promise<Player>;
  get(id: string): Promise<Player | null>;
  /**
   * The current player: scoped to the signed-in user once
   * setCurrentUser() has been called (unscoped before auth resolves and
   * in unit tests, matching the pre-auth single-player behavior).
   */
  getFirst(): Promise<Player | null>;
  update(id: string, patch: Partial<CreatePlayerInput>): Promise<Player | null>;
  /** Scopes reads/creates to this auth user (null clears the scope). */
  setCurrentUser(userId: string | null): void;
  /**
   * Single-user upgrade path: rows created before auth existed
   * (user_id NULL) are claimed by the first signed-in user.
   */
  claimUnowned(userId: string): Promise<void>;
}
