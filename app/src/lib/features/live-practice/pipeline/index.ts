// Public barrel for the swappable live shot-analysis pipeline.
export { analyzeAndScore, type ScoredShot } from "./core";
export {
  createRepoShotStore,
  type ShotStore,
  type SaveShotInput,
} from "./shot-store";
export {
  createLocalPipeline,
  createServerPipeline,
  createLiveShotPipeline,
  resolvePipelineLocation,
  type LiveShotPipeline,
  type PipelineLocation,
  type ProcessInput,
  type ProcessedShot,
} from "./pipeline";
