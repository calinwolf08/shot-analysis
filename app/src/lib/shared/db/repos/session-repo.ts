/**
 * Repository contract (implemented on the server with Kysely —
 * lib/server/repos.ts; the browser uses the API-backed remote repos).
 */
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
