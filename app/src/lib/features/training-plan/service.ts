import type { MetricName } from "$lib/features/benchmarks";
import {
  createFocusAreaRepo,
  type FocusAreaRepo,
  type FocusAreaRow,
  type IssueGroupId,
} from "$lib/features/diagnosis";
import { createDrillService, type DrillService } from "$lib/features/drills";
import type { RepoContext } from "$lib/shared/db/repo-base";
import { createPlayerRepo, type PlayerRepo } from "$lib/shared/db/repos";
import {
  adaptFocusAreas,
  generatePlan,
  PLAN_CONFIG,
  type PlanFocusArea,
} from "./generator";
import {
  createPlanRepo,
  type Plan,
  type PlanItem,
  type PlanRepo,
} from "./repo/plan-repo";

export interface PlanWithItems {
  plan: Plan;
  items: PlanItem[];
}

export interface TrainingPlanService {
  /**
   * Builds and persists a plan block from a scored+diagnosed assessment
   * session. An existing active plan feeds the adaptation rule, then is
   * marked superseded.
   */
  generateForSession(sessionId: string, playerId: string): Promise<Plan>;
  /**
   * Closes the loop for a plan's reassessment item: marks the item done,
   * then builds the next adapted block (previous plan superseded).
   */
  completeReassessment(
    sessionId: string,
    playerId: string,
    planItemId: string,
  ): Promise<Plan>;
  getPlan(planId: string): Promise<PlanWithItems | null>;
  getActivePlan(playerId: string): Promise<PlanWithItems | null>;
  completeItem(itemId: string): Promise<void>;
  /** The active plan's next pending item (Home "Today" card). */
  nextPendingItem(
    playerId: string,
  ): Promise<{ plan: Plan; item: PlanItem } | null>;
}

export interface TrainingPlanServiceDeps {
  plans?: PlanRepo;
  drills?: DrillService;
  focusAreas?: FocusAreaRepo;
  players?: PlayerRepo;
}

/** Focus payload persisted by the diagnosis service in focus_areas rows. */
interface StoredFocusPayload {
  displayName: string;
  surfaced: boolean;
  metrics: { metric: MetricName; severity: number }[];
}

function toPlanFocusArea(row: FocusAreaRow): PlanFocusArea | null {
  const payload = row.metrics as Partial<StoredFocusPayload> | null;
  if (!payload?.surfaced) return null;
  const metrics = [...(payload.metrics ?? [])]
    .sort((a, b) => b.severity - a.severity || a.metric.localeCompare(b.metric))
    .map((m) => m.metric);
  return {
    issueGroup: row.issueGroup as IssueGroupId,
    displayName: payload.displayName ?? row.issueGroup,
    severity: row.severity,
    focusMetrics: metrics,
  };
}

export function createTrainingPlanService(
  ctx: RepoContext,
  deps: TrainingPlanServiceDeps = {},
): TrainingPlanService {
  const plans = deps.plans ?? createPlanRepo(ctx);
  const drills = deps.drills ?? createDrillService(ctx);
  const focusAreas = deps.focusAreas ?? createFocusAreaRepo(ctx);
  const players = deps.players ?? createPlayerRepo(ctx);

  async function withItems(plan: Plan | null): Promise<PlanWithItems | null> {
    if (!plan) return null;
    return { plan, items: await plans.getItems(plan.id) };
  }

  return {
    async generateForSession(sessionId, playerId) {
      const player = await players.get(playerId);
      if (!player) throw new Error(`Unknown player: ${playerId}`);

      const rows = await focusAreas.listBySession(sessionId);
      const current = rows
        .sort((a, b) => a.rank - b.rank)
        .map(toPlanFocusArea)
        .filter((a): a is PlanFocusArea => a !== null);

      const active = await plans.getActiveByPlayer(playerId);
      const previous = active ? (active.focus as PlanFocusArea[] | null) : null;
      const focus = adaptFocusAreas(
        current,
        previous,
        PLAN_CONFIG.improvementThreshold,
      );

      const spec = generatePlan({
        focusAreas: focus,
        drills: await drills.list(),
        playerLevel: player.level,
      });

      if (active) await plans.setStatus(active.id, "superseded");
      return plans.createWithItems({
        playerId,
        sourceSessionId: sessionId,
        focus: spec.focus,
        items: spec.items,
      });
    },

    async completeReassessment(sessionId, playerId, planItemId) {
      await plans.updateItemStatus(planItemId, "done");
      return this.generateForSession(sessionId, playerId);
    },

    getPlan: async (planId) => withItems(await plans.get(planId)),

    getActivePlan: async (playerId) =>
      withItems(await plans.getActiveByPlayer(playerId)),

    completeItem: (itemId) => plans.updateItemStatus(itemId, "done"),

    async nextPendingItem(playerId) {
      const active = await withItems(await plans.getActiveByPlayer(playerId));
      if (!active) return null;
      const item = active.items.find((i) => i.status === "pending");
      return item ? { plan: active.plan, item } : null;
    },
  };
}
