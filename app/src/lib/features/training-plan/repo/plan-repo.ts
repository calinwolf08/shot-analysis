import { parseJson, type RepoContext } from "$lib/shared/db/repo-base";

export type PlanStatus = "active" | "completed" | "superseded";
export type PlanItemType = "drill" | "live_practice" | "reassessment";
export type PlanItemStatus = "pending" | "done" | "skipped";

export interface Plan {
  id: string;
  playerId: string;
  sourceSessionId: string;
  status: PlanStatus;
  /** Focus areas snapshot the plan was generated from. */
  focus: unknown;
  createdAt: number;
}

export interface PlanItem {
  id: string;
  planId: string;
  dayIndex: number;
  position: number;
  type: PlanItemType;
  drillId: string | null;
  focusMetric: string | null;
  targetReps: number | null;
  status: PlanItemStatus;
  completedAt: number | null;
}

export interface CreatePlanInput {
  playerId: string;
  sourceSessionId: string;
  focus: unknown;
  items: Omit<PlanItem, "id" | "planId" | "status" | "completedAt">[];
}

export interface PlanRepo {
  /** Creates a plan + items atomically; returns the persisted plan. */
  createWithItems(input: CreatePlanInput): Promise<Plan>;
  get(id: string): Promise<Plan | null>;
  getActiveByPlayer(playerId: string): Promise<Plan | null>;
  getItems(planId: string): Promise<PlanItem[]>;
  getItem(itemId: string): Promise<PlanItem | null>;
  updateItemStatus(itemId: string, status: PlanItemStatus): Promise<void>;
  setStatus(planId: string, status: PlanStatus): Promise<void>;
}

interface PlanRowDb {
  id: string;
  player_id: string;
  source_session_id: string;
  status: PlanStatus;
  focus_json: string;
  created_at: number;
}

interface ItemRowDb {
  id: string;
  plan_id: string;
  day_index: number;
  position: number;
  type: PlanItemType;
  drill_id: string | null;
  focus_metric: string | null;
  target_reps: number | null;
  status: PlanItemStatus;
  completed_at: number | null;
}

function toPlan(r: PlanRowDb): Plan {
  return {
    id: r.id,
    playerId: r.player_id,
    sourceSessionId: r.source_session_id,
    status: r.status,
    focus: parseJson(r.focus_json, `plans.${r.id}`),
    createdAt: r.created_at,
  };
}

function toItem(r: ItemRowDb): PlanItem {
  return {
    id: r.id,
    planId: r.plan_id,
    dayIndex: r.day_index,
    position: r.position,
    type: r.type,
    drillId: r.drill_id,
    focusMetric: r.focus_metric,
    targetReps: r.target_reps,
    status: r.status,
    completedAt: r.completed_at,
  };
}

export function createPlanRepo(ctx: RepoContext): PlanRepo {
  const { db, clock, ids } = ctx;
  return {
    async createWithItems(input) {
      const plan: Plan = {
        id: ids.next(),
        playerId: input.playerId,
        sourceSessionId: input.sourceSessionId,
        status: "active",
        focus: input.focus,
        createdAt: clock.now(),
      };
      await db.transaction(async (tx) => {
        await tx.run(
          `INSERT INTO plans (id, player_id, source_session_id, status, focus_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            plan.id,
            plan.playerId,
            plan.sourceSessionId,
            plan.status,
            JSON.stringify(plan.focus),
            plan.createdAt,
          ],
        );
        for (const item of input.items) {
          await tx.run(
            `INSERT INTO plan_items (id, plan_id, day_index, position, type, drill_id, focus_metric, target_reps, status, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL)`,
            [
              ids.next(),
              plan.id,
              item.dayIndex,
              item.position,
              item.type,
              item.drillId,
              item.focusMetric,
              item.targetReps,
            ],
          );
        }
      });
      return plan;
    },

    async get(id) {
      const rows = await db.query<PlanRowDb>(
        "SELECT * FROM plans WHERE id = ?",
        [id],
      );
      return rows[0] ? toPlan(rows[0]) : null;
    },

    async getActiveByPlayer(playerId) {
      const rows = await db.query<PlanRowDb>(
        `SELECT * FROM plans WHERE player_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [playerId],
      );
      return rows[0] ? toPlan(rows[0]) : null;
    },

    async getItems(planId) {
      const rows = await db.query<ItemRowDb>(
        "SELECT * FROM plan_items WHERE plan_id = ? ORDER BY day_index, position",
        [planId],
      );
      return rows.map(toItem);
    },

    async getItem(itemId) {
      const rows = await db.query<ItemRowDb>(
        "SELECT * FROM plan_items WHERE id = ?",
        [itemId],
      );
      return rows[0] ? toItem(rows[0]) : null;
    },

    async updateItemStatus(itemId, status) {
      await db.run(
        "UPDATE plan_items SET status = ?, completed_at = ? WHERE id = ?",
        [status, status === "pending" ? null : clock.now(), itemId],
      );
    },

    async setStatus(planId, status) {
      await db.run("UPDATE plans SET status = ? WHERE id = ?", [
        status,
        planId,
      ]);
    },
  };
}
