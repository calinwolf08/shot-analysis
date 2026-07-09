// Public barrel for the drills feature.
export {
  createDrillRepo,
  type DrillRepo,
  type DrillRow,
} from "./repo/drill-repo";
export {
  drillFileSchema,
  drillSchema,
  InvalidDrillError,
  parseDrillFile,
  type Drill,
  type DrillFile,
} from "./schema";
export {
  createDrillService,
  type DrillQuery,
  type DrillService,
  type DrillServiceDeps,
} from "./service";
export { default as DrillPlayerScreen } from "./components/DrillPlayerScreen.svelte";
