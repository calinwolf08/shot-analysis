import { describe, expect, it } from "vitest";
import type { MetricName } from "$lib/features/benchmarks";
import type { MetricScore, RepScore } from "$lib/features/scoring";
import { compareHalves } from "../summary/summary-logic";

function rep(scores: Partial<Record<MetricName, number>>): RepScore {
  const perMetric: Partial<Record<MetricName, MetricScore>> = {};
  for (const [metric, score] of Object.entries(scores)) {
    perMetric[metric as MetricName] = {
      metric: metric as MetricName,
      category: "shooting-arm",
      score: score!,
      value: 0,
      ideal: 0,
      deviation: null,
      direction: "low",
      status: score! >= 0.75 ? "pass" : "fail",
      weight: 1,
    } as MetricScore;
  }
  return {
    formScore: 70,
    perMetric,
    perCategory: {} as RepScore["perCategory"],
    excludedMetrics: [],
    scoringVersion: 1,
  };
}

describe("compareHalves", () => {
  it("needs at least 4 reps", () => {
    const reps = [rep({ kneeFlexion: 0.2 }), rep({ kneeFlexion: 0.9 })];
    expect(compareHalves(reps)).toEqual({ improved: [], appeared: [] });
  });

  it("finds improved and appeared metrics half-over-half", () => {
    const firstHalf = [
      rep({ kneeFlexion: 0.3, wristSnapAngle: 0.9, headTilt: 0.8 }),
      rep({ kneeFlexion: 0.4, wristSnapAngle: 0.9, headTilt: 0.8 }),
    ];
    const secondHalf = [
      rep({ kneeFlexion: 0.8, wristSnapAngle: 0.5, headTilt: 0.82 }),
      rep({ kneeFlexion: 0.9, wristSnapAngle: 0.55, headTilt: 0.78 }),
    ];
    const result = compareHalves([...firstHalf, ...secondHalf]);
    expect(result.improved).toEqual(["kneeFlexion"]); // 0.35 → 0.85
    expect(result.appeared).toEqual(["wristSnapAngle"]); // 0.9 → 0.525
    // headTilt moved < threshold → mentioned nowhere.
  });

  it("ignores metrics absent from one half and respects the threshold", () => {
    const reps = [
      rep({ kneeFlexion: 0.5 }),
      rep({ kneeFlexion: 0.5 }),
      rep({ kneeFlexion: 0.6, ballDip: 0.2 }),
      rep({ kneeFlexion: 0.6, ballDip: 0.3 }),
    ];
    const result = compareHalves(reps, 0.15);
    expect(result).toEqual({ improved: [], appeared: [] }); // 0.5→0.6 < 0.15; ballDip only in 2nd half

    const looser = compareHalves(reps, 0.05);
    expect(looser.improved).toEqual(["kneeFlexion"]);
  });
});
