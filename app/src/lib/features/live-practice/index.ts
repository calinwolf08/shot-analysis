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
  wristRise,
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
export { default as LiveDebugHud } from "./loop/LiveDebugHud.svelte";

// Live-first redesign (steps 4–6): the de-sessioned store, swappable analysis
// pipeline, voice readback, and angle gate.
export {
  LivePracticeStore,
  type LivePracticeStoreDeps,
  type LoopPhase,
  type ShotEntry,
  type ShotFeedback,
} from "./loop/live-practice-store.svelte";
export { buildWorstReadback, phraseFor } from "./loop/readback";
export {
  evaluateAngleGate,
  requiredOrientation,
  type AngleGateResult,
  type SideOrientation,
} from "./setup/angle-gate";
export {
  analyzeAndScore,
  scorecardForShot,
  createRepoShotStore,
  createLiveShotPipeline,
  createLocalPipeline,
  createServerPipeline,
  resolvePipelineLocation,
  type ScoredShot,
  type ShotStore,
  type LiveShotPipeline,
  type PipelineLocation,
  type ProcessInput,
  type ProcessedShot,
} from "./pipeline";
export { default as PracticeScreen } from "./loop/PracticeScreen.svelte";
export { default as ShotReviewScreen } from "./review/ShotReviewScreen.svelte";
export {
  createPresenceTracker,
  type PresenceState,
  type PresenceTracker,
  type PresenceTrackerOptions,
} from "./loop/presence";
