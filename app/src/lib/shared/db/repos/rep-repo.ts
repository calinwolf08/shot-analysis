/**
 * Repository contract (implemented on the server with Kysely —
 * lib/server/repos.ts; the browser uses the API-backed remote repos).
 */
import type { RepRecord } from "./types";

export interface CreateRepInput {
  sessionId: string;
  repIndex: number;
  shotId?: string;
  repScore?: number;
  primaryCue?: string;
  feedback?: unknown;
}

export interface RepRepo {
  create(input: CreateRepInput): Promise<RepRecord>;
  listBySession(sessionId: string): Promise<RepRecord[]>;
}
