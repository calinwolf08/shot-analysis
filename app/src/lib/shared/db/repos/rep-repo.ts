import { parseJson, type RepoContext } from "../repo-base";
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

interface RepRow {
  id: string;
  session_id: string;
  rep_index: number;
  shot_id: string | null;
  rep_score: number | null;
  primary_cue: string | null;
  feedback_json: string | null;
  created_at: number;
}

function toRep(r: RepRow): RepRecord {
  return {
    id: r.id,
    sessionId: r.session_id,
    repIndex: r.rep_index,
    shotId: r.shot_id,
    repScore: r.rep_score,
    primaryCue: r.primary_cue,
    feedback: r.feedback_json
      ? parseJson(r.feedback_json, `reps.${r.id}`)
      : null,
    createdAt: r.created_at,
  };
}

export function createRepRepo(ctx: RepoContext): RepRepo {
  const { db, clock, ids } = ctx;
  return {
    async create(input) {
      const rep: RepRecord = {
        id: ids.next(),
        sessionId: input.sessionId,
        repIndex: input.repIndex,
        shotId: input.shotId ?? null,
        repScore: input.repScore ?? null,
        primaryCue: input.primaryCue ?? null,
        feedback: input.feedback ?? null,
        createdAt: clock.now(),
      };
      await db.run(
        `INSERT INTO reps (id, session_id, rep_index, shot_id, rep_score, primary_cue, feedback_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rep.id,
          rep.sessionId,
          rep.repIndex,
          rep.shotId,
          rep.repScore,
          rep.primaryCue,
          rep.feedback === null ? null : JSON.stringify(rep.feedback),
          rep.createdAt,
        ],
      );
      return rep;
    },

    async listBySession(sessionId) {
      const rows = await db.query<RepRow>(
        "SELECT * FROM reps WHERE session_id = ? ORDER BY rep_index",
        [sessionId],
      );
      return rows.map(toRep);
    },
  };
}
