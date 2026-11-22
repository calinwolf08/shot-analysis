/**
 * Repository contract (implemented on the server with Kysely —
 * lib/server/repos.ts; the browser uses the API-backed remote repos).
 */
import type { ScoreRecord, ScoreScope } from "./types";

export interface InsertScoreInput {
  scope: ScoreScope;
  refId: string;
  benchmarkId: string;
  scoringVersion: number;
  formScore?: number | null;
  consistencyScore?: number | null;
  efficiencyScore?: number | null;
  overallScore?: number | null;
  breakdown: unknown;
}

export interface ScoreRepo {
  insert(input: InsertScoreInput): Promise<ScoreRecord>;
  /** Most recent score for a shot/session (latest scoring run wins). */
  latestForRef(scope: ScoreScope, refId: string): Promise<ScoreRecord | null>;
  /** Full scoring history for a ref (all benchmark/scoring versions). */
  listForRef(scope: ScoreScope, refId: string): Promise<ScoreRecord[]>;
  /** Latest session-scope scores for many refs at once. */
  latestForRefs(
    scope: ScoreScope,
    refIds: string[],
  ): Promise<Map<string, ScoreRecord>>;
}
