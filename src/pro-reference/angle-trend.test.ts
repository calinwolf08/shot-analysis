import { describe, expect, it } from "vitest";
import {
  DEFAULT_TREND_CONFIG,
  applyAngleTrends,
  fitAngleTrends,
  suggestedLimit,
} from "./angle-trend";
import {
  DEFAULT_BUILD_CONFIG,
  buildProTargets,
  type MeasuredAttempt,
} from "./build";

/** Deterministic noise in [-1, 1]. */
const noise = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/**
 * Players with their own true knee depth, filmed at a spread of angles; the
 * measurement drifts by `bias` per degree (leftover angle error) and a
 * timing metric doesn't drift at all.
 */
function data(
  players: { id: string; truth: number; angles: number[] }[],
  bias: number,
  jitter = 1,
): MeasuredAttempt[] {
  let k = 0;
  return players.flatMap((p) =>
    p.angles.map((angle, i) => ({
      player: p.id,
      clip: "c",
      shotNumber: i + 1,
      angle,
      values: {
        "load.knee_depth": {
          value: p.truth + bias * angle + jitter * noise(k++),
          phase: "load" as const,
          kind: "structure" as const,
          unit: "deg" as const,
          lowResolution: false,
        },
        "rise.t_start": {
          value: 0.1 + 0.02 * noise(k++),
          phase: "rise" as const,
          kind: "timing" as const,
          unit: "phase" as const,
          lowResolution: false,
        },
      },
    })),
  );
}

const spread = [2, 6, 10, 14, 18, 22, 25, 4, 12, 20];
const players = [
  { id: "a", truth: 120, angles: spread },
  { id: "b", truth: 130, angles: spread.map((x) => x + 1) },
  { id: "c", truth: 125, angles: spread.map((x) => Math.max(0, x - 1)) },
];

describe("leftover camera-angle error", () => {
  it("finds a real drift, within players, and ignores a metric without one", () => {
    const t = fitAngleTrends(data(players, 0.4));
    expect(t["load.knee_depth"]!.significant).toBe(true);
    expect(t["load.knee_depth"]!.slope).toBeCloseTo(0.4, 1);
    expect(t["rise.t_start"]!.significant).toBe(false);
    expect(t["rise.t_start"]!.reason).toBe("no clear trend");
  });

  it("differences BETWEEN players aren't mistaken for an angle effect", () => {
    // Player B is both deeper-kneed and always filmed from further round.
    const confounded = [
      { id: "a", truth: 120, angles: [1, 3, 5, 7, 2, 4, 6, 8] },
      { id: "b", truth: 140, angles: [21, 23, 25, 27, 22, 24, 26, 28] },
      { id: "c", truth: 130, angles: [11, 13, 15, 17, 12, 14, 16, 18] },
    ];
    const t = fitAngleTrends(data(confounded, 0), {
      ...DEFAULT_TREND_CONFIG,
      minAngleSpread: 1,
    });
    // A naive fit across players would see +1°/° here.
    expect(Math.abs(t["load.knee_depth"]!.slope)).toBeLessThan(0.3);
    expect(t["load.knee_depth"]!.significant).toBe(false);
  });

  it("needs enough data before applying anything", () => {
    const few = fitAngleTrends(data([players[0]!], 0.4));
    expect(few["load.knee_depth"]!.significant).toBe(false);
    expect(few["load.knee_depth"]!.reason).toMatch(/attempts|players/);
    const same = fitAngleTrends(
      data(
        players.map((p) => ({ ...p, angles: p.angles.map(() => 10) })),
        0.4,
      ),
    );
    expect(same["load.knee_depth"]!.reason).toMatch(/too similar/);
  });

  it("brings values to their 0° equivalent", () => {
    const d = data(players, 0.4, 0);
    const fixed = applyAngleTrends(d, fitAngleTrends(d));
    for (const a of fixed) {
      const truth = players.find((p) => p.id === a.player)!.truth;
      expect(a.values["load.knee_depth"]!.value).toBeCloseTo(truth, 1);
    }
  });

  it("the build removes the drift before making targets", () => {
    const d = data(players, 0.4);
    const off = buildProTargets({
      attempts: d,
      players: {},
      config: {
        ...DEFAULT_BUILD_CONFIG,
        angleTrend: { ...DEFAULT_TREND_CONFIG, enabled: false },
      },
      metricsSchema: 4,
    });
    const on = buildProTargets({
      attempts: d,
      players: {},
      config: DEFAULT_BUILD_CONFIG,
      metricsSchema: 4,
    });
    // Mean angle ≈ 13°: uncorrected, values sit ~5° high.
    expect(off.targets.metrics["load.knee_depth"]!.ideal).toBeGreaterThan(128);
    expect(on.targets.metrics["load.knee_depth"]!.ideal).toBeLessThan(127);
    expect(on.angleTrends["load.knee_depth"]!.significant).toBe(true);
  });

  it("suggests an angle limit where the residual spread grows", () => {
    // Noise grows with the angle beyond 20°.
    const d: MeasuredAttempt[] = [];
    let k = 0;
    for (const p of ["a", "b", "c"]) {
      for (const angle of [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 22, 24, 26, 28]) {
        const j = angle > 20 ? 8 : 1;
        d.push({
          player: p,
          clip: "c",
          shotNumber: k,
          angle,
          values: {
            "load.knee_depth": {
              value: 120 + j * noise(k++),
              phase: "load",
              kind: "structure",
              unit: "deg",
              lowResolution: false,
            },
          },
        });
      }
    }
    expect(suggestedLimit(fitAngleTrends(d)["load.knee_depth"]!)).toBe(20);
  });
});
