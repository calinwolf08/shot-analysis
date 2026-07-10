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
