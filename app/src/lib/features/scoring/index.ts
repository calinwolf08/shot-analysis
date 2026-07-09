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
