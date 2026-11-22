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
  const { kdb, clock, ids } = ctx;
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
      await kdb.transaction().execute(async (trx) => {
        await trx
          .insertInto("plans")
          .values({
            id: plan.id,
            player_id: plan.playerId,
            source_session_id: plan.sourceSessionId,
            status: plan.status,
            focus_json: JSON.stringify(plan.focus),
            created_at: plan.createdAt,
          })
          .execute();
        for (const item of input.items) {
          await trx
            .insertInto("plan_items")
            .values({
              id: ids.next(),
              plan_id: plan.id,
              day_index: item.dayIndex,
              position: item.position,
              type: item.type,
              drill_id: item.drillId,
              focus_metric: item.focusMetric,
              target_reps: item.targetReps,
              status: "pending",
              completed_at: null,
            })
            .execute();
        }
      });
      return plan;
    },

    async get(id) {
      const row = await kdb
        .selectFrom("plans")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toPlan(row) : null;
    },

    async getActiveByPlayer(playerId) {
      const row = await kdb
        .selectFrom("plans")
        .selectAll()
        .where("player_id", "=", playerId)
        .where("status", "=", "active")
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst();
      return row ? toPlan(row) : null;
    },

    async getItems(planId) {
      const rows = await kdb
        .selectFrom("plan_items")
        .selectAll()
        .where("plan_id", "=", planId)
        .orderBy("day_index")
        .orderBy("position")
        .execute();
      return rows.map(toItem);
    },

    async getItem(itemId) {
      const row = await kdb
        .selectFrom("plan_items")
        .selectAll()
        .where("id", "=", itemId)
        .executeTakeFirst();
      return row ? toItem(row) : null;
    },

    async updateItemStatus(itemId, status) {
      await kdb
        .updateTable("plan_items")
        .set({
          status,
          completed_at: status === "pending" ? null : clock.now(),
        })
        .where("id", "=", itemId)
        .execute();
    },

    async setStatus(planId, status) {
      await kdb
        .updateTable("plans")
        .set({ status })
        .where("id", "=", planId)
        .execute();
    },
  };
}
