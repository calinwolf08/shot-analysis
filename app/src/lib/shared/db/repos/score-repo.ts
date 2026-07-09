import { parseJson, type RepoContext } from "../repo-base";
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

interface ScoreRow {
  id: string;
  scope: ScoreScope;
  ref_id: string;
  benchmark_id: string;
  scoring_version: number;
  form_score: number | null;
  consistency_score: number | null;
  efficiency_score: number | null;
  overall_score: number | null;
  breakdown_json: string;
  created_at: number;
}

function toScore(r: ScoreRow): ScoreRecord {
  return {
    id: r.id,
    scope: r.scope,
    refId: r.ref_id,
    benchmarkId: r.benchmark_id,
    scoringVersion: r.scoring_version,
    formScore: r.form_score,
    consistencyScore: r.consistency_score,
    efficiencyScore: r.efficiency_score,
    overallScore: r.overall_score,
    breakdown: parseJson(r.breakdown_json, `scores.${r.id}`),
    createdAt: r.created_at,
  };
}

export function createScoreRepo(ctx: RepoContext): ScoreRepo {
  const { db, clock, ids } = ctx;
  return {
    async insert(input) {
      const score: ScoreRecord = {
        id: ids.next(),
        scope: input.scope,
        refId: input.refId,
        benchmarkId: input.benchmarkId,
        scoringVersion: input.scoringVersion,
        formScore: input.formScore ?? null,
        consistencyScore: input.consistencyScore ?? null,
        efficiencyScore: input.efficiencyScore ?? null,
        overallScore: input.overallScore ?? null,
        breakdown: input.breakdown,
        createdAt: clock.now(),
      };
      await db.run(
        `INSERT INTO scores (id, scope, ref_id, benchmark_id, scoring_version,
           form_score, consistency_score, efficiency_score, overall_score, breakdown_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          score.id,
          score.scope,
          score.refId,
          score.benchmarkId,
          score.scoringVersion,
          score.formScore,
          score.consistencyScore,
          score.efficiencyScore,
          score.overallScore,
          JSON.stringify(score.breakdown),
          score.createdAt,
        ],
      );
      return score;
    },

    async latestForRef(scope, refId) {
      const rows = await db.query<ScoreRow>(
        `SELECT * FROM scores WHERE scope = ? AND ref_id = ?
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        [scope, refId],
      );
      return rows[0] ? toScore(rows[0]) : null;
    },

    async listForRef(scope, refId) {
      const rows = await db.query<ScoreRow>(
        `SELECT * FROM scores WHERE scope = ? AND ref_id = ? ORDER BY created_at`,
        [scope, refId],
      );
      return rows.map(toScore);
    },

    async latestForRefs(scope, refIds) {
      const result = new Map<string, ScoreRecord>();
      if (refIds.length === 0) return result;
      const placeholders = refIds.map(() => "?").join(",");
      const rows = await db.query<ScoreRow>(
        `SELECT * FROM scores WHERE scope = ? AND ref_id IN (${placeholders})
         ORDER BY created_at, id`,
        [scope, ...refIds],
      );
      for (const row of rows) {
        result.set(row.ref_id, toScore(row)); // later rows overwrite → latest wins
      }
      return result;
    },
  };
}
