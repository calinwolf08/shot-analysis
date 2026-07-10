import type { RepoContext } from "../repo-base";
import type { Session, SessionStatus, SessionType } from "./types";

export interface CreateSessionInput {
  playerId: string;
  type: SessionType;
  planItemId?: string;
  focusMetric?: string;
  notes?: string;
}

export interface SessionRepo {
  create(input: CreateSessionInput): Promise<Session>;
  get(id: string): Promise<Session | null>;
  /** Marks completed and stamps completed_at. */
  complete(id: string): Promise<void>;
  /** Marks aborted (kept for history; scores are never computed). */
  abort(id: string): Promise<void>;
  listByPlayer(
    playerId: string,
    filter?: { type?: SessionType; status?: SessionStatus },
  ): Promise<Session[]>;
}

interface SessionRow {
  id: string;
  player_id: string;
  type: SessionType;
  status: SessionStatus;
  plan_item_id: string | null;
  focus_metric: string | null;
  started_at: number;
  completed_at: number | null;
  notes: string | null;
}

function toSession(r: SessionRow): Session {
  return {
    id: r.id,
    playerId: r.player_id,
    type: r.type,
    status: r.status,
    planItemId: r.plan_item_id,
    focusMetric: r.focus_metric,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    notes: r.notes,
  };
}

export function createSessionRepo(ctx: RepoContext): SessionRepo {
  const { db, clock, ids } = ctx;
  return {
    async create(input) {
      const session: Session = {
        id: ids.next(),
        playerId: input.playerId,
        type: input.type,
        status: "in_progress",
        planItemId: input.planItemId ?? null,
        focusMetric: input.focusMetric ?? null,
        startedAt: clock.now(),
        completedAt: null,
        notes: input.notes ?? null,
      };
      await db.run(
        `INSERT INTO sessions (id, player_id, type, status, plan_item_id, focus_metric, started_at, completed_at, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.playerId,
          session.type,
          session.status,
          session.planItemId,
          session.focusMetric,
          session.startedAt,
          session.completedAt,
          session.notes,
        ],
      );
      return session;
    },

    async get(id) {
      const rows = await db.query<SessionRow>(
        "SELECT * FROM sessions WHERE id = ?",
        [id],
      );
      return rows[0] ? toSession(rows[0]) : null;
    },

    async complete(id) {
      await db.run(
        "UPDATE sessions SET status = 'completed', completed_at = ? WHERE id = ?",
        [clock.now(), id],
      );
    },

    async abort(id) {
      await db.run(
        "UPDATE sessions SET status = 'aborted', completed_at = ? WHERE id = ?",
        [clock.now(), id],
      );
    },

    async listByPlayer(playerId, filter = {}) {
      const clauses = ["player_id = ?"];
      const params: (string | number)[] = [playerId];
      if (filter.type) {
        clauses.push("type = ?");
        params.push(filter.type);
      }
      if (filter.status) {
        clauses.push("status = ?");
        params.push(filter.status);
      }
      const rows = await db.query<SessionRow>(
        `SELECT * FROM sessions WHERE ${clauses.join(" AND ")} ORDER BY started_at DESC`,
        params,
      );
      return rows.map(toSession);
    },
  };
}
