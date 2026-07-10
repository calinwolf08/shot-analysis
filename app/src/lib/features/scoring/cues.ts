import type { BenchmarkProfile, MetricName } from "$lib/features/benchmarks";
import type { Cue, CueSelection, MetricScore, RepScore } from "./types";

function toCue(m: MetricScore, benchmark: BenchmarkProfile): Cue {
  const target = benchmark.targets[m.metric];
  let feedback: string | null = null;
  if (target) {
    if (m.direction === "low") feedback = target.feedback.tooLow ?? null;
    else if (m.direction === "high") feedback = target.feedback.tooHigh ?? null;
    else if (m.direction === "incorrect")
      feedback = target.feedback.incorrect ?? null;
  }
  return {
    metric: m.metric,
    text: target?.shortCue ?? m.metric,
    direction: m.direction,
    feedback,
  };
}

/**
 * Picks ONE primary coaching cue (+ up to 2 secondary) from a scored rep:
 * worst weighted problems first, plan focus metric always prioritized when
 * it needs work.
 */
export function selectCues(
  repScore: RepScore,
  benchmark: BenchmarkProfile,
  focusMetric?: MetricName,
): CueSelection {
  const candidates = (Object.values(repScore.perMetric) as MetricScore[])
    .filter((m) => m.status !== "pass")
    .sort((a, b) => {
      const focusA = a.metric === focusMetric ? 1 : 0;
      const focusB = b.metric === focusMetric ? 1 : 0;
      if (focusA !== focusB) return focusB - focusA;
      const badnessA = (1 - a.score) * a.weight;
      const badnessB = (1 - b.score) * b.weight;
      if (badnessA !== badnessB) return badnessB - badnessA;
      return a.metric.localeCompare(b.metric); // deterministic tie-break
    });

  const primary = candidates[0] ? toCue(candidates[0], benchmark) : null;
  const secondary = candidates.slice(1, 3).map((m) => toCue(m, benchmark));
  return { primary, secondary };
}
