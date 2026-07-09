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
  const { db, clock, ids } = ctx;
  return {
    async replaceForSession(sessionId, areas) {
      const now = clock.now();
      const rows: FocusAreaRow[] = areas.map((a) => ({
        ...a,
        id: ids.next(),
        sessionId,
        createdAt: now,
      }));
      await db.transaction(async (tx) => {
        await tx.run("DELETE FROM focus_areas WHERE session_id = ?", [
          sessionId,
        ]);
        for (const row of rows) {
          await tx.run(
            `INSERT INTO focus_areas (id, session_id, rank, issue_group, severity, metrics_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              row.id,
              row.sessionId,
              row.rank,
              row.issueGroup,
              row.severity,
              JSON.stringify(row.metrics),
              row.createdAt,
            ],
          );
        }
      });
      return rows;
    },

    async listBySession(sessionId) {
      const rows = await db.query<DbRow>(
        "SELECT * FROM focus_areas WHERE session_id = ? ORDER BY rank",
        [sessionId],
      );
      return rows.map(toRow);
    },
  };
}
