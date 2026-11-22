import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUILD_CONFIG,
  angleWeight,
  buildConfig,
  buildProTargets,
  reportMarkdown,
  robustSpread,
  weightedQuantile,
  type MeasuredAttempt,
} from "./build";

const w = (vs: number[]) => vs.map((v) => ({ v, w: 1 }));

describe("weighted statistics", () => {
  it("quantiles interpolate; weights shift them", () => {
    expect(weightedQuantile(w([1, 2, 3, 4, 5]), 0.5)).toBeCloseTo(3);
    expect(weightedQuantile(w([1, 2, 3, 4, 5]), 0)).toBe(1);
    expect(weightedQuantile(w([1, 2, 3, 4, 5]), 1)).toBe(5);
    const heavy = [
      { v: 0, w: 1 },
      { v: 10, w: 9 },
    ];
    expect(weightedQuantile(heavy, 0.5)).toBeGreaterThan(5);
  });

  it("robust spread ≈ SD for normal-ish data, ignores one wild value", () => {
    const base = [9, 10, 11, 10, 9.5, 10.5];
    const s = robustSpread(w(base));
    expect(s).toBeGreaterThan(0.3);
    expect(s).toBeLessThan(1.5);
    expect(robustSpread(w([...base, 100]))).toBeLessThan(2);
  });

  it("near-side-on shots weigh more", () => {
    expect(angleWeight(0)).toBe(1);
    expect(angleWeight(20)).toBeCloseTo(0.883, 3);
    expect(angleWeight(-20)).toBe(angleWeight(20));
  });
});

/** n attempts for a player with values drawn around `mean` ± `jitter`. */
function attempts(
  player: string,
  n: number,
  mean: number,
  jitter: number,
  angle = 0,
): MeasuredAttempt[] {
  return Array.from({ length: n }, (_, i) => ({
    player,
    clip: "c1",
    shotNumber: i + 1,
    angle,
    values: {
      "load.knee_depth": {
        value: mean + (jitter * (((i * 7) % 5) - 2)) / 2,
        phase: "load",
        kind: "structure",
        unit: "deg",
        lowResolution: false,
      },
    },
  }));
}

const players = {
  a: { name: "A", shootingHand: "right" as const },
  b: { name: "B", shootingHand: "right" as const },
  c: { name: "C", shootingHand: "left" as const },
  d: { name: "D", shootingHand: "right" as const },
};

describe("buildProTargets", () => {
  it("each pro counts equally, however many shots they have", () => {
    const r = buildProTargets({
      attempts: [...attempts("a", 40, 120, 2), ...attempts("b", 5, 130, 2)],
      players,
      config: DEFAULT_BUILD_CONFIG,
      metricsSchema: 4,
    });
    const t = r.targets.metrics["load.knee_depth"]!;
    // Equal weight: the median sits between the two pros (at the edge of
    // A's cluster), not deep inside A's 40 shots (≈120).
    expect(t.ideal).toBeGreaterThan(121.5);
    expect(t.ideal).toBeLessThan(128.5);
    expect(t.players).toBe(2);
    expect(r.profiles.pros.map((p) => [p.id, p.shots])).toEqual([
      ["a", 40],
      ["b", 5],
    ]);
    expect(r.profiles.pros[0]!.metrics["load.knee_depth"]!.value).toBeCloseTo(
      120,
      0,
    );
  });

  it("the band is the 20th–80th percentile: some pro shots score above 0", () => {
    const r = buildProTargets({
      attempts: [...attempts("a", 10, 120, 6), ...attempts("b", 10, 126, 6)],
      players,
      config: DEFAULT_BUILD_CONFIG,
      metricsSchema: 4,
    });
    const t = r.targets.metrics["load.knee_depth"]!;
    expect(t.passMin).toBeGreaterThan(114);
    expect(t.passMax).toBeLessThan(132);
    const rep = r.report.find((m) => m.id === "load.knee_depth")!;
    expect(rep.zeroShare).toBeGreaterThan(0.4);
    expect(rep.zeroShare).toBeLessThan(1);
    expect(rep.meanScore).toBeGreaterThan(0);
  });

  it("percentiles are configurable per metric", () => {
    const cfg = buildConfig({
      percentiles: {
        default: [0.2, 0.8],
        byMetric: { "load.knee_depth": [0, 1] },
      },
    });
    const r = buildProTargets({
      attempts: [...attempts("a", 10, 120, 6), ...attempts("b", 10, 126, 6)],
      players,
      config: cfg,
      metricsSchema: 4,
    });
    expect(r.report[0]!.zeroShare).toBeCloseTo(1, 6);
  });

  it("pros who disagree far more than they vary make a metric 'style' (unscored)", () => {
    const r = buildProTargets({
      attempts: [
        ...attempts("a", 6, 100, 1),
        ...attempts("b", 6, 130, 1),
        ...attempts("c", 6, 160, 1),
      ],
      players,
      config: DEFAULT_BUILD_CONFIG,
      metricsSchema: 4,
    });
    const t = r.targets.metrics["load.knee_depth"]!;
    expect(t.style).toBe(true);
    expect(t.scored).toBe(false);
    const scored = buildProTargets({
      attempts: [
        ...attempts("a", 6, 100, 1),
        ...attempts("b", 6, 130, 1),
        ...attempts("c", 6, 160, 1),
      ],
      players,
      config: buildConfig({ styleScored: true }),
      metricsSchema: 4,
    });
    expect(scored.targets.metrics["load.knee_depth"]!.scored).toBe(true);
  });

  it("fundamentals stay scored when pros agree", () => {
    const r = buildProTargets({
      attempts: [
        ...attempts("a", 6, 120, 4),
        ...attempts("b", 6, 121, 4),
        ...attempts("c", 6, 119, 4),
      ],
      players,
      config: DEFAULT_BUILD_CONFIG,
      metricsSchema: 4,
    });
    expect(r.targets.metrics["load.knee_depth"]).toMatchObject({
      style: false,
      scored: true,
    });
  });

  it("players below the minimum shots are left out", () => {
    const r = buildProTargets({
      attempts: [...attempts("a", 6, 120, 2), ...attempts("d", 3, 150, 2)],
      players,
      config: DEFAULT_BUILD_CONFIG,
      metricsSchema: 4,
    });
    expect(r.droppedPlayers).toEqual([{ id: "d", shots: 3 }]);
    expect(r.profiles.pros.map((p) => p.id)).toEqual(["a"]);
  });

  it("keeps hand edits (label, wording, override) from the previous file", () => {
    const r = buildProTargets({
      attempts: attempts("a", 6, 120, 2),
      players,
      config: DEFAULT_BUILD_CONFIG,
      metricsSchema: 4,
      previous: {
        metrics: {
          "load.knee_depth": {
            label: "Knees",
            wording: {
              low: { phrase: "x", cue: "y" },
              high: { phrase: "z", cue: "w" },
            },
            override: { passMin: 100 },
          } as never,
        },
      },
    });
    const t = r.targets.metrics["load.knee_depth"]!;
    expect(t.label).toBe("Knees");
    expect(t.override).toEqual({ passMin: 100 });
  });

  it("is deterministic and writes a report", () => {
    const input = {
      attempts: [...attempts("a", 6, 120, 2), ...attempts("b", 6, 124, 2)],
      players,
      config: DEFAULT_BUILD_CONFIG,
      metricsSchema: 4,
      generatedAt: "2026-01-01T00:00:00Z",
    };
    expect(buildProTargets(input)).toEqual(buildProTargets(input));
    const md = reportMarkdown(buildProTargets(input), {
      attempts: {
        used: 12,
        dropped: [{ where: "a/c1 shot 9", why: "excluded" }],
      },
      detection: [{ event: "Set point", n: 12, median: 1, p90: 3 }],
    });
    expect(md).toContain("| load.knee_depth | 2 | 12 | yes |");
    expect(md).toContain("| Set point | 12 | 1.0 | 3.0 |");
  });
});
