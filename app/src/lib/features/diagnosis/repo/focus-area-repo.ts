import { parseJson, type RepoContext } from "$lib/shared/db/repo-base";

export interface FocusAreaRow {
  id: string;
  sessionId: string;
  rank: number;
  issueGroup: string;
  severity: number;
  /** Contributing metric details (names, scores, deviations). */
  metrics: unknown;
  createdAt: number;
}

export interface FocusAreaRepo {
  /** Replaces the diagnosis for a session atomically. */
  replaceForSession(
    sessionId: string,
    areas: Omit<FocusAreaRow, "id" | "sessionId" | "createdAt">[],
  ): Promise<FocusAreaRow[]>;
  listBySession(sessionId: string): Promise<FocusAreaRow[]>;
}

interface DbRow {
  id: string;
  session_id: string;
  rank: number;
  issue_group: string;
  severity: number;
  metrics_json: string;
  created_at: number;
}

function toRow(r: DbRow): FocusAreaRow {
  return {
    id: r.id,
    sessionId: r.session_id,
    rank: r.rank,
    issueGroup: r.issue_group,
    severity: r.severity,
    metrics: parseJson(r.metrics_json, `focus_areas.${r.id}`),
    createdAt: r.created_at,
  };
}

export function createFocusAreaRepo(ctx: RepoContext): FocusAreaRepo {
  const { kdb, clock, ids } = ctx;
  return {
    async replaceForSession(sessionId, areas) {
      const now = clock.now();
      const rows: FocusAreaRow[] = areas.map((a) => ({
        ...a,
        id: ids.next(),
        sessionId,
        createdAt: now,
      }));
      await kdb.transaction().execute(async (trx) => {
        await trx
          .deleteFrom("focus_areas")
          .where("session_id", "=", sessionId)
          .execute();
        for (const row of rows) {
          await trx
            .insertInto("focus_areas")
            .values({
              id: row.id,
              session_id: row.sessionId,
              rank: row.rank,
              issue_group: row.issueGroup,
              severity: row.severity,
              metrics_json: JSON.stringify(row.metrics),
              created_at: row.createdAt,
            })
            .execute();
        }
      });
      return rows;
    },

    async listBySession(sessionId) {
      const rows = await kdb
        .selectFrom("focus_areas")
        .selectAll()
        .where("session_id", "=", sessionId)
        .orderBy("rank")
        .execute();
      return rows.map(toRow);
    },
  };
}
