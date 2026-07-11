import { type RepoContext } from "../repo-base";
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

interface PlayerRow {
  id: string;
  name: string;
  shooting_hand: ShootingHand;
  level: PlayerLevel;
  created_at: number;
  updated_at: number;
  user_id: string | null;
}

function toPlayer(r: PlayerRow): Player {
  return {
    id: r.id,
    name: r.name,
    shootingHand: r.shooting_hand,
    level: r.level,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createPlayerRepo(ctx: RepoContext): PlayerRepo {
  const { db, clock, ids } = ctx;
  let currentUserId: string | null = null;
  return {
    setCurrentUser(userId) {
      currentUserId = userId;
    },

    async claimUnowned(userId) {
      await db.run("UPDATE players SET user_id = ? WHERE user_id IS NULL", [
        userId,
      ]);
    },

    async create(input) {
      const now = clock.now();
      const player: Player = {
        id: ids.next(),
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      await db.run(
        `INSERT INTO players (id, name, shooting_hand, level, created_at, updated_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          player.id,
          player.name,
          player.shootingHand,
          player.level,
          player.createdAt,
          player.updatedAt,
          currentUserId,
        ],
      );
      return player;
    },

    async get(id) {
      const rows = await db.query<PlayerRow>(
        "SELECT * FROM players WHERE id = ?",
        [id],
      );
      return rows[0] ? toPlayer(rows[0]) : null;
    },

    async getFirst() {
      const rows = currentUserId
        ? await db.query<PlayerRow>(
            "SELECT * FROM players WHERE user_id = ? ORDER BY created_at LIMIT 1",
            [currentUserId],
          )
        : await db.query<PlayerRow>(
            "SELECT * FROM players ORDER BY created_at LIMIT 1",
          );
      return rows[0] ? toPlayer(rows[0]) : null;
    },

    async update(id, patch) {
      const existing = await this.get(id);
      if (!existing) return null;
      const next: Player = {
        ...existing,
        ...patch,
        updatedAt: clock.now(),
      };
      await db.run(
        `UPDATE players SET name = ?, shooting_hand = ?, level = ?, updated_at = ? WHERE id = ?`,
        [next.name, next.shootingHand, next.level, next.updatedAt, id],
      );
      return next;
    },
  };
}
