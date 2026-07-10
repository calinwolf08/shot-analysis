// Public barrel for the scoring feature.
export { scoreNumeric, scoreRep } from "./engine";
export { selectCues } from "./cues";
export {
  DEFAULT_SCORING_CONFIG,
  SCORING_VERSION,
  type Cue,
  type CueSelection,
  type DeviationDirection,
  type ExcludedMetric,
  type MetricScore,
  type MetricStatus,
  type RepScore,
  type ScoringConfig,
} from "./types";
export {
  consistencyCurve,
  DEFAULT_SESSION_WEIGHTS,
  EFFICIENCY_METRICS,
  scoreSession,
  type MetricConsistency,
  type SessionBreakdown,
  type SessionScore,
  type SessionScoreWeights,
} from "./session";
export {
  createScoringService,
  type ScoredShot,
  type ScoringService,
  type ScoringServiceDeps,
} from "./service";
