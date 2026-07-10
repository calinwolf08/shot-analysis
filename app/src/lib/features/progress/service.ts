/**
 * ProgressService — read-model queries for the progress dashboards:
 * score history, per-metric trends (mean ± σ per session), totals and
 * practice streaks. Pure SQL over the session/score/shot_metrics tables.
 */
import type { MetricName } from "$lib/features/benchmarks";
import type { RepoContext } from "$lib/shared/db/repo-base";
import type { SessionType } from "$lib/shared/db/repos";

export interface ScoreHistoryPoint {
  sessionId: string;
  type: SessionType;
  completedAt: number;
  overallScore: number | null;
  formScore: number | null;
  consistencyScore: number | null;
  efficiencyScore: number | null;
}

export interface MetricTrendPoint {
  sessionId: string;
  completedAt: number;
  mean: number;
  /** Population σ across the session's included shots. */
  std: number;
  n: number;
}

export interface ProgressTotals {
  sessions: number;
  assessments: number;
  repsAnalyzed: number;
  /** Consecutive practice days ending today (or yesterday). */
  streakDays: number;
}

export interface ProgressService {
  scoreHistory(playerId: string): Promise<ScoreHistoryPoint[]>;
  metricTrend(
    playerId: string,
    metric: MetricName,
  ): Promise<MetricTrendPoint[]>;
  totals(playerId: string): Promise<ProgressTotals>;
}

const DAY_MS = 86_400_000;

export function createProgressService(ctx: RepoContext): ProgressService {
  const { db, clock } = ctx;

  return {
    async scoreHistory(playerId) {
      const rows = await db.query<{
        session_id: string;
        type: SessionType;
        completed_at: number;
        overall_score: number | null;
        form_score: number | null;
        consistency_score: number | null;
        efficiency_score: number | null;
      }>(
        `SELECT s.id AS session_id, s.type, s.completed_at,
                sc.overall_score, sc.form_score, sc.consistency_score, sc.efficiency_score
         FROM sessions s
         JOIN scores sc ON sc.scope = 'session' AND sc.ref_id = s.id
         WHERE s.player_id = ? AND s.status = 'completed'
           AND sc.created_at = (
             SELECT MAX(created_at) FROM scores
             WHERE scope = 'session' AND ref_id = s.id
           )
         ORDER BY s.completed_at, s.id`,
        [playerId],
      );
      return rows.map((r) => ({
        sessionId: r.session_id,
        type: r.type,
        completedAt: r.completed_at,
        overallScore: r.overall_score,
        formScore: r.form_score,
        consistencyScore: r.consistency_score,
        efficiencyScore: r.efficiency_score,
      }));
    },

    async metricTrend(playerId, metric) {
      const rows = await db.query<{
        session_id: string;
        completed_at: number;
        mean: number;
        mean_sq: number;
        n: number;
      }>(
        `SELECT s.id AS session_id, s.completed_at,
                AVG(m.value_num) AS mean,
                AVG(m.value_num * m.value_num) AS mean_sq,
                COUNT(m.value_num) AS n
         FROM sessions s
         JOIN shots sh ON sh.session_id = s.id AND sh.excluded = 0
         JOIN shot_metrics m ON m.shot_id = sh.id AND m.metric_name = ?
         WHERE s.player_id = ? AND s.status = 'completed'
           AND m.value_num IS NOT NULL AND m.confidence >= 0.4
         GROUP BY s.id, s.completed_at
         ORDER BY s.completed_at, s.id`,
        [metric, playerId],
      );
      return rows.map((r) => ({
        sessionId: r.session_id,
        completedAt: r.completed_at,
        mean: r.mean,
        std: Math.sqrt(Math.max(0, r.mean_sq - r.mean * r.mean)),
        n: r.n,
      }));
    },

    async totals(playerId) {
      const [counts] = await db.query<{
        sessions: number;
        assessments: number;
      }>(
        `SELECT COUNT(*) AS sessions,
                SUM(CASE WHEN type = 'assessment' THEN 1 ELSE 0 END) AS assessments
         FROM sessions WHERE player_id = ? AND status = 'completed'`,
        [playerId],
      );
      const [reps] = await db.query<{ n: number }>(
        `SELECT COUNT(*) AS n
         FROM shots sh JOIN sessions s ON s.id = sh.session_id
         WHERE s.player_id = ? AND s.status = 'completed' AND sh.excluded = 0`,
        [playerId],
      );
      const dayRows = await db.query<{ day: number }>(
        `SELECT DISTINCT CAST(completed_at / ${DAY_MS} AS INTEGER) AS day
         FROM sessions
         WHERE player_id = ? AND status = 'completed' AND completed_at IS NOT NULL
         ORDER BY day DESC`,
        [playerId],
      );

      const today = Math.floor(clock.now() / DAY_MS);
      let streak = 0;
      // A streak survives until a full day is skipped: start counting from
      // today or yesterday, whichever has the most recent practice.
      let expected = dayRows[0]?.day === today ? today : today - 1;
      for (const { day } of dayRows) {
        if (day === expected) {
          streak += 1;
          expected -= 1;
        } else if (day < expected) {
          break;
        }
      }

      return {
        sessions: counts?.sessions ?? 0,
        assessments: counts?.assessments ?? 0,
        repsAnalyzed: reps?.n ?? 0,
        streakDays: streak,
      };
    },
  };
}
