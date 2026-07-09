import { describe, expect, it } from "vitest";
import type {
  BenchmarkProfile,
  BenchmarkTarget,
} from "$lib/features/benchmarks";
import { makeShotAnalysis } from "$lib/shared/testing/fixtures";
import { scoreNumeric, scoreRep } from "../engine";
import { DEFAULT_SCORING_CONFIG } from "../types";

function target(partial: Partial<BenchmarkTarget>): BenchmarkTarget {
  return {
    ideal: 90,
    acceptable: { min: 80, max: 100 },
    priority: "medium",
    populationStats: null,
    feedback: { tooLow: "too low", tooHigh: "too high" },
    displayName: "Test metric",
    shortCue: "Fix it",
    category: "shooting-arm",
    explanation: "test",
    ...partial,
  } as BenchmarkTarget;
}

function benchmark(targets: Record<string, BenchmarkTarget>): BenchmarkProfile {
  return {
    id: "test-bench",
    name: "Test",
    version: 1,
    isPlaceholder: true,
    basedOn: "test",
    targets,
  } as unknown as BenchmarkProfile;
}

describe("scoreNumeric — golden values (ideal 90, range 80–100 → halfRange 10, deadband 1)", () => {
  const cases: [value: number, expected: number][] = [
    [90, 1], // exactly ideal
    [90.5, 1], // inside deadband
    [91, 1], // at deadband edge
    [89, 1], // deadband is symmetric
    [95, 1 - (0.5 * (5 - 1)) / 9], // inside acceptable → 0.7778
    [85, 1 - (0.5 * (5 - 1)) / 9], // symmetric below
    [100, 0.5], // at the acceptable bound
    [80, 0.5], // at the lower bound
    [105, 0.25], // halfway to 2× range
    [110, 0], // at 2× range → 0
    [120, 0], // beyond 2× range clamps to 0
  ];
  for (const [value, expected] of cases) {
    it(`value ${value} → ${expected.toFixed(4)}`, () => {
      const r = scoreNumeric(value, 90, 80, 100);
      expect(r.score).toBeCloseTo(expected, 6);
    });
  }

  it("reports deviation direction", () => {
    expect(scoreNumeric(85, 90, 80, 100).direction).toBe("low");
    expect(scoreNumeric(95, 90, 80, 100).direction).toBe("high");
    expect(scoreNumeric(90, 90, 80, 100).direction).toBeNull();
  });
});

describe("scoreNumeric — asymmetric range (ideal 90, acceptable 85–105)", () => {
  // Below side: halfRange 5, deadband 0.5. Above side: halfRange 15, deadband 1.5.
  it("scores the below side with its own half-range", () => {
    expect(scoreNumeric(87, 90, 85, 105).score).toBeCloseTo(
      1 - (0.5 * (3 - 0.5)) / 4.5,
      6,
    ); // 0.7222
    expect(scoreNumeric(85, 90, 85, 105).score).toBeCloseTo(0.5, 6);
    expect(scoreNumeric(84, 90, 85, 105).score).toBeCloseTo(
      0.5 * (1 - (6 - 5) / 5),
      6,
    ); // 0.4
    expect(scoreNumeric(80, 90, 85, 105).score).toBe(0); // 2× below half-range
  });

  it("scores the above side with its own half-range", () => {
    expect(scoreNumeric(100, 90, 85, 105).score).toBeCloseTo(
      1 - (0.5 * (10 - 1.5)) / 13.5,
      6,
    ); // 0.6852
    expect(scoreNumeric(105, 90, 85, 105).score).toBeCloseTo(0.5, 6);
    expect(scoreNumeric(120, 90, 85, 105).score).toBeCloseTo(0, 6);
  });

  it("handles a degenerate target with ideal on the bound", () => {
    expect(scoreNumeric(5, 10, 10, 20).score).toBe(0);
    expect(scoreNumeric(10, 10, 10, 20).score).toBe(1);
  });
});

describe("scoreNumeric — properties", () => {
  it("is monotonically non-increasing as |dev| grows (both sides)", () => {
    for (const [min, ideal, max] of [
      [80, 90, 100],
      [85, 90, 105],
      [0, 10, 100],
    ] as const) {
      let prev = Infinity;
      for (let dev = 0; dev <= 60; dev += 0.25) {
        const s = scoreNumeric(ideal + dev, ideal, min, max).score;
        expect(s).toBeLessThanOrEqual(prev + 1e-12);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
        prev = s;
      }
      prev = Infinity;
      for (let dev = 0; dev <= 60; dev += 0.25) {
        const s = scoreNumeric(ideal - dev, ideal, min, max).score;
        expect(s).toBeLessThanOrEqual(prev + 1e-12);
        prev = s;
      }
    }
  });
});

describe("scoreRep", () => {
  it("scores categorical pass as 1 and miss as the miss score", () => {
    const bench = benchmark({
      guideHandPosition: target({
        ideal: "side",
        acceptable: ["side"],
        category: "guide-arm",
      }),
    });
    const pass = scoreRep(
      makeShotAnalysis({
        metrics: { guideHandPosition: { value: "side", confidence: 0.9 } },
      }),
      bench,
    );
    expect(pass.perMetric.guideHandPosition?.score).toBe(1);
    expect(pass.perMetric.guideHandPosition?.status).toBe("pass");

    const miss = scoreRep(
      makeShotAnalysis({
        metrics: { guideHandPosition: { value: "under", confidence: 0.9 } },
      }),
      bench,
    );
    expect(miss.perMetric.guideHandPosition?.score).toBe(
      DEFAULT_SCORING_CONFIG.categoricalMissScore,
    );
    expect(miss.perMetric.guideHandPosition?.status).toBe("fail");
    expect(miss.perMetric.guideHandPosition?.direction).toBe("incorrect");
  });

  it("excludes low-confidence metrics and renormalizes weights", () => {
    const bench = benchmark({
      shootingElbowAngle: target({}),
      kneeFlexion: target({ category: "lower-body" }),
    });
    const rep = scoreRep(
      makeShotAnalysis({
        metrics: {
          shootingElbowAngle: { value: 90, confidence: 0.9 }, // perfect
          kneeFlexion: { value: 40, confidence: 0.2 }, // terrible BUT excluded
        },
      }),
      bench,
    );
    expect(rep.excludedMetrics).toContainEqual({
      metric: "kneeFlexion",
      reason: "low-confidence",
      confidence: 0.2,
    });
    expect(rep.perMetric.kneeFlexion).toBeUndefined();
    expect(rep.formScore).toBeCloseTo(100, 6); // only the perfect metric counts
  });

  it("excludes metrics without a benchmark target", () => {
    const bench = benchmark({ shootingElbowAngle: target({}) });
    const rep = scoreRep(
      makeShotAnalysis({
        metrics: {
          shootingElbowAngle: { value: 90, confidence: 0.9 },
          releasePoint: { value: 0.4, confidence: 0.9 },
        },
      }),
      bench,
    );
    expect(
      rep.excludedMetrics.find((e) => e.metric === "releasePoint")?.reason,
    ).toBe("no-target");
  });

  it("weights by priority × confidence", () => {
    const bench = benchmark({
      shootingElbowAngle: target({ priority: "high" }), // weight 3×0.9
      headTilt: target({ priority: "low", category: "posture" }), // weight 1×0.9
    });
    const rep = scoreRep(
      makeShotAnalysis({
        metrics: {
          shootingElbowAngle: { value: 90, confidence: 0.9 }, // score 1
          headTilt: { value: 100, confidence: 0.9 }, // score 0.5 (at bound)
        },
      }),
      bench,
    );
    // (1·2.7 + 0.5·0.9) / 3.6 = 0.875 → 87.5
    expect(rep.formScore).toBeCloseTo(87.5, 6);
  });

  it("produces a per-category breakdown with null for empty categories", () => {
    const bench = benchmark({
      shootingElbowAngle: target({ category: "shooting-arm" }),
      kneeFlexion: target({ category: "lower-body" }),
    });
    const rep = scoreRep(
      makeShotAnalysis({
        metrics: {
          shootingElbowAngle: { value: 90, confidence: 0.9 },
          kneeFlexion: { value: 100, confidence: 0.9 },
        },
      }),
      bench,
    );
    expect(rep.perCategory["shooting-arm"]).toBeCloseTo(100, 6);
    expect(rep.perCategory["lower-body"]).toBeCloseTo(50, 6);
    expect(rep.perCategory.timing).toBeNull();
    expect(rep.perCategory["guide-arm"]).toBeNull();
  });

  it("returns null formScore when nothing is scorable", () => {
    const bench = benchmark({ shootingElbowAngle: target({}) });
    const rep = scoreRep(
      makeShotAnalysis({
        metrics: { shootingElbowAngle: { value: 90, confidence: 0.1 } },
      }),
      bench,
    );
    expect(rep.formScore).toBeNull();
  });

  it("keeps formScore within [0, 100] across random-ish inputs", () => {
    const bench = benchmark({
      shootingElbowAngle: target({}),
      kneeFlexion: target({ category: "lower-body", priority: "high" }),
      headTilt: target({ category: "posture", priority: "low" }),
    });
    for (let seed = 0; seed < 200; seed++) {
      const v = (n: number) => 40 + ((seed * 7919 + n * 104729) % 120);
      const rep = scoreRep(
        makeShotAnalysis({
          metrics: {
            shootingElbowAngle: {
              value: v(1),
              confidence: 0.5 + (seed % 5) / 10,
            },
            kneeFlexion: { value: v(2), confidence: 0.9 },
            headTilt: { value: v(3), confidence: 0.45 },
          },
        }),
        bench,
      );
      expect(rep.formScore).not.toBeNull();
      expect(rep.formScore!).toBeGreaterThanOrEqual(0);
      expect(rep.formScore!).toBeLessThanOrEqual(100);
    }
  });
});

describe("scoreRep — value/target type mismatch", () => {
  it("treats a numeric value against a categorical target as a miss", () => {
    const bench = benchmark({
      guideHandPosition: target({
        ideal: "side",
        acceptable: ["side"],
        category: "guide-arm",
      }),
    });
    const rep = scoreRep(
      makeShotAnalysis({
        metrics: { guideHandPosition: { value: 3, confidence: 0.9 } },
      }),
      bench,
    );
    expect(rep.perMetric.guideHandPosition?.score).toBe(
      DEFAULT_SCORING_CONFIG.categoricalMissScore,
    );
    expect(rep.perMetric.guideHandPosition?.direction).toBe("incorrect");
  });
});
