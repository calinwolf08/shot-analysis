// Public barrel for the training-plan feature.
export {
  createPlanRepo,
  type CreatePlanInput,
  type Plan,
  type PlanItem,
  type PlanItemStatus,
  type PlanItemType,
  type PlanRepo,
  type PlanStatus,
} from "./repo/plan-repo";
export {
  adaptFocusAreas,
  generatePlan,
  PLAN_CONFIG,
  type GeneratePlanInput,
  type PlanFocusArea,
  type PlanSpec,
  type PlanSpecItem,
} from "./generator";
export {
  createTrainingPlanService,
  type PlanWithItems,
  type TrainingPlanService,
  type TrainingPlanServiceDeps,
} from "./service";
export { default as PlanOverview } from "./components/PlanOverview.svelte";
