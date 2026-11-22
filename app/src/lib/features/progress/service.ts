/**
 * ProgressService — read-model queries for the progress dashboards:
 * score history, per-metric trends (mean ± σ per session), totals and
 * practice streaks. Pure SQL over the session/score/shot_metrics tables.
 */
import { sql } from "kysely";
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
  const { kdb, clock } = ctx;

  return {
    async scoreHistory(playerId) {
      // Each completed session with its LATEST session score.
      const rows = await kdb
        .selectFrom("sessions as s")
        .innerJoin("scores as sc", (j) =>
          j.onRef("sc.ref_id", "=", "s.id").on("sc.scope", "=", "session"),
        )
        .select([
          "s.id as session_id",
          "s.type",
          "s.completed_at",
          "sc.overall_score",
          "sc.form_score",
          "sc.consistency_score",
          "sc.efficiency_score",
        ])
        .where("s.player_id", "=", playerId)
        .where("s.status", "=", "completed")
        .where("sc.created_at", "=", (eb) =>
          eb
            .selectFrom("scores as latest")
            .select((e) => e.fn.max("latest.created_at").as("m"))
            .where("latest.scope", "=", "session")
            .whereRef("latest.ref_id", "=", "s.id"),
        )
        .orderBy("s.completed_at")
        .orderBy("s.id")
        .execute();
      return rows.map((r) => ({
        sessionId: r.session_id,
        type: r.type as SessionType,
        completedAt: r.completed_at as number,
        overallScore: r.overall_score,
        formScore: r.form_score,
        consistencyScore: r.consistency_score,
        efficiencyScore: r.efficiency_score,
      }));
    },

    async metricTrend(playerId, metric) {
      const rows = await kdb
        .selectFrom("sessions as s")
        .innerJoin("shots as sh", (j) =>
          j.onRef("sh.session_id", "=", "s.id").on("sh.excluded", "=", 0),
        )
        .innerJoin("shot_metrics as m", (j) =>
          j.onRef("m.shot_id", "=", "sh.id").on("m.metric_name", "=", metric),
        )
        .select((eb) => [
          "s.id as session_id",
          "s.completed_at",
          eb.fn.avg<number>("m.value_num").as("mean"),
          eb.fn.avg<number>(sql`m.value_num * m.value_num`).as("mean_sq"),
          eb.fn.count<number>("m.value_num").as("n"),
        ])
        .where("s.player_id", "=", playerId)
        .where("s.status", "=", "completed")
        .where("m.value_num", "is not", null)
        .where("m.confidence", ">=", 0.4)
        .groupBy(["s.id", "s.completed_at"])
        .orderBy("s.completed_at")
        .orderBy("s.id")
        .execute();
      return rows.map((r) => {
        const mean = Number(r.mean);
        const meanSq = Number(r.mean_sq);
        return {
          sessionId: r.session_id,
          completedAt: r.completed_at as number,
          mean,
          std: Math.sqrt(Math.max(0, meanSq - mean * mean)),
          n: Number(r.n),
        };
      });
    },

    async totals(playerId) {
      const counts = await kdb
        .selectFrom("sessions")
        .select((eb) => [
          eb.fn.countAll<number>().as("sessions"),
          eb.fn
            .sum<
              number | null
            >(eb.case().when("type", "=", "assessment").then(1).else(0).end())
            .as("assessments"),
        ])
        .where("player_id", "=", playerId)
        .where("status", "=", "completed")
        .executeTakeFirst();
      const reps = await kdb
        .selectFrom("shots as sh")
        .innerJoin("sessions as s", "s.id", "sh.session_id")
        .select((eb) => eb.fn.countAll<number>().as("n"))
        .where("s.player_id", "=", playerId)
        .where("s.status", "=", "completed")
        .where("sh.excluded", "=", 0)
        .executeTakeFirst();
      // Distinct UTC days with a completed session (integer division of
      // ms timestamps works the same on SQLite and Postgres).
      const dayRows = await kdb
        .selectFrom("sessions")
        .select(
          sql<number>`CAST(completed_at / ${sql.lit(DAY_MS)} AS INTEGER)`.as(
            "day",
          ),
        )
        .distinct()
        .where("player_id", "=", playerId)
        .where("status", "=", "completed")
        .where("completed_at", "is not", null)
        .orderBy("day", "desc")
        .execute();

      const today = Math.floor(clock.now() / DAY_MS);
      let streak = 0;
      // A streak survives until a full day is skipped: start counting from
      // today or yesterday, whichever has the most recent practice.
      const days = dayRows.map((r) => Number(r.day));
      let expected = days[0] === today ? today : today - 1;
      for (const day of days) {
        if (day === expected) {
          streak += 1;
          expected -= 1;
        } else if (day < expected) {
          break;
        }
      }

      return {
        sessions: Number(counts?.sessions ?? 0),
        assessments: Number(counts?.assessments ?? 0),
        repsAnalyzed: Number(reps?.n ?? 0),
        streakDays: streak,
      };
    },
  };
}
