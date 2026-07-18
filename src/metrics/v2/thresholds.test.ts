import { describe, it, expect } from "vitest";
import { deriveThresholds, categoryOf, labelFor, type PlayerSummary } from "./thresholds";
import type { Stats } from "./stats";

function stat(median: number, iqr = 0.02): Stats {
  return { n: 3, median, min: median - iqr, max: median + iqr, p25: median - iqr / 2, p75: median + iqr / 2, iqr };
}

describe("categoryOf / labelFor", () => {
  it("maps ids to categories and labels", () => {
    expect(categoryOf("seq.ball_low__ball_rise")).toBe("sequencing");
    expect(categoryOf("load.depth_drop")).toBe("load");
    expect(categoryOf("setPoint.elbow_angle")).toBe("setPoint");
    expect(labelFor("load.depth_drop")).toBe("Depth drop");
    expect(labelFor("seq.ball_low__ball_rise")).toBe("Ball low → Ball rise");
  });
});

describe("deriveThresholds", () => {
  it("scores a tight, universal metric and reports-only a divergent one", () => {
    const players: PlayerSummary[] = [
      { player: "A", metrics: { "load.depth_drop": stat(0.10), "setPoint.wrist_cock": stat(90, 3) } },
      { player: "B", metrics: { "load.depth_drop": stat(0.10), "setPoint.wrist_cock": stat(60, 3) } },
      { player: "C", metrics: { "load.depth_drop": stat(0.10), "setPoint.wrist_cock": stat(120, 3) } },
    ];
    const th = deriveThresholds(players);
    // depth_drop: all pros identical → tight → scored.
    expect(th.metrics["load.depth_drop"]!.reportedOnly).toBe(false);
    expect(th.metrics["load.depth_drop"]!.weight).toBeGreaterThan(0);
    expect(th.metrics["load.depth_drop"]!.tightness).toBeCloseTo(1, 2);
    // wrist_cock: pros differ wildly (60..120) → reported-only.
    expect(th.metrics["setPoint.wrist_cock"]!.reportedOnly).toBe(true);
    expect(th.metrics["setPoint.wrist_cock"]!.weight).toBe(0);
  });

  it("reports-only a metric with low coverage", () => {
    const players: PlayerSummary[] = [
      { player: "A", metrics: { "load.hip_depth": stat(0.4) } },
      { player: "B", metrics: {} },
      { player: "C", metrics: {} },
    ];
    const th = deriveThresholds(players);
    expect(th.metrics["load.hip_depth"]!.coverage).toBeCloseTo(1 / 3, 5);
    expect(th.metrics["load.hip_depth"]!.reportedOnly).toBe(true);
  });

  it("pads the band by pooled within-player IQR", () => {
    const players: PlayerSummary[] = [
      { player: "A", metrics: { "rise.wrist_cock_peak": stat(80, 4) } },
      { player: "B", metrics: { "rise.wrist_cock_peak": stat(82, 4) } },
    ];
    const th = deriveThresholds(players, { iqrPad: 0.5 });
    const band = th.metrics["rise.wrist_cock_peak"]!.band;
    // medians 80..82, pad 0.5*IQR(4)=2 → [78, 84]
    expect(band[0]).toBeCloseTo(78, 5);
    expect(band[1]).toBeCloseTo(84, 5);
  });
});
