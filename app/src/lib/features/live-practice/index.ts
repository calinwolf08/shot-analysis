// Public barrel for the live-practice feature. Cross-feature imports go through here only.
export {
  createLiveRepCoordinator,
  DEFAULT_LIVE_REP_CONFIG,
  type CoordinatorEvents,
  type CoordinatorState,
  type LiveRepConfig,
  type LiveRepCoordinator,
  type LiveRepCoordinatorDeps,
  type RepTrigger,
  type RepWindow,
} from "./coordinator/coordinator";
export {
  dribbleNoise,
  makeCursor,
  noPose,
  shotArc,
  stillPose,
  type StreamCursor,
} from "./coordinator/synthetic-streams";
export {
  CHECK_DEFAULTS,
  createSustainedCheck,
  isFullBodyVisible,
  isLightingOk,
  isSideView,
  isSideViewFrame,
  isStable,
  meanLuma,
} from "./setup/checks";
export { default as SetupScreen } from "./setup/SetupScreen.svelte";
export {
  LiveSessionStore,
  type LiveSessionStoreDeps,
  type LoopPhase,
  type RepEntry,
  type RepFeedback,
} from "./loop/live-session-store.svelte";
export { default as PracticeLoopScreen } from "./loop/PracticeLoopScreen.svelte";
export { compareHalves, type HalvesComparison } from "./summary/summary-logic";
export { default as SummaryScreen } from "./summary/SummaryScreen.svelte";
