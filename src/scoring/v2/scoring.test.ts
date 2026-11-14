import { describe, it, expect } from "vitest";
import { scoreShot } from "./index";
import { measure, unavailable, type ShotMetricsV2 } from "../../metrics/v2/types";
import type { Thresholds } from "../../metrics/v2/thresholds";

function shot(over: {
  seq?: { from: any; to: any; m: ReturnType<typeof measure> }[];
  structure?: ShotMetricsV2["structure"];
}): ShotMetricsV2 {
  return {
    schemaVersion: 1,
    shot: { startFrame: 0, endFrame: 10, fps: 30, cameraOrientation: "side-left" },
    reliability: { poseConfidence: 0.9, sideView: true },
    sequencing: {
      events: [],
      gaps: (over.seq ?? []).map((g) => ({ from: g.from, to: g.to, gap: g.m })),
      coverage: 1,
    },
    structure: over.structure ?? {},
  };
}

const thresholds: Thresholds = {
  version: 1,
  generatedFrom: ["A", "B"],
  metrics: {
    "seq.ball_low__ball_rise": {
      band: [0.02, 0.1],
      weight: 1,
      tightness: 0.9,
      coverage: 1,
      category: "sequencing",
      label: "Ball low → Ball rise",
      reportedOnly: false,
    },
    "load.depth_drop": {
      band: [0.06, 0.1],
      weight: 1,
      tightness: 0.9,
      coverage: 1,
      category: "load",
      label: "Depth drop",
      reportedOnly: false,
    },
    "setPoint.wrist_cock": {
      band: [60, 120],
      weight: 0,
      tightness: 0.1,
      coverage: 1,
      category: "setPoint",
      label: "Wrist cock",
      reportedOnly: true,
    },
  },
};

describe("scoreShot", () => {
  it("scores 100 / good inside the band", () => {
    const s = scoreShot(
      shot({
        seq: [{ from: "ball_low", to: "ball_rise", m: measure(0.05, [4]) }],
        structure: { load: { depth_drop: measure(0.08, [4]) } },
      }),
      thresholds,
    );
    const depth = s.structure.categories.find((c) => c.id === "load")!.metrics.find((m) => m.id === "load.depth_drop")!;
    expect(depth.score).toBe(100);
    expect(depth.status).toBe("good");
    expect(s.structure.score).toBe(100);
  });

  it("falls off outside the band", () => {
    const s = scoreShot(
      shot({ structure: { load: { depth_drop: measure(0.2, [4]) } } }),
      thresholds,
    );
    const depth = s.structure.categories[0]!.metrics.find((m) => m.id === "load.depth_drop")!;
    expect(depth.score!).toBeLessThan(100);
    expect(depth.score!).toBeGreaterThanOrEqual(0);
  });

  it("penalizes a sequencing order violation hard", () => {
    const s = scoreShot(
      shot({ seq: [{ from: "ball_low", to: "ball_rise", m: measure(-0.05, [4]) }] }),
      thresholds,
    );
    const gap = s.sequencing.metrics.find((m) => m.id === "seq.ball_low__ball_rise")!;
    expect(gap.score!).toBeLessThanOrEqual(10);
    expect(s.sequencing.orderScore).toBe(0); // the one ordered pair was violated
  });

  it("excludes unmeasured metrics and reports the measured fraction", () => {
    const s = scoreShot(
      shot({
        // depth_drop reliable; seq gap unavailable → unmeasured
        seq: [{ from: "ball_low", to: "ball_rise", m: unavailable("not detected") }],
        structure: { load: { depth_drop: measure(0.08, [4]) } },
      }),
      thresholds,
    );
    const gap = s.sequencing.metrics.find((m) => m.id === "seq.ball_low__ball_rise")!;
    expect(gap.status).toBe("unmeasured");
    expect(gap.score).toBeNull();
    expect(s.sequencing.measuredFraction).toBe(0); // the only weighted seq metric was missing
    expect(s.structure.measuredFraction).toBe(1); // depth_drop measured (wrist_cock is reported-only, weight 0)
  });

  it("reported-only metrics (weight 0) never affect the score", () => {
    const s = scoreShot(
      shot({ structure: { setPoint: { wrist_cock: measure(9999, [7]) } } }),
      thresholds,
    );
    // wrist_cock is wildly off but reported-only → structure score stays null
    // (no scoreable metric measured).
    const cat = s.structure.categories.find((c) => c.id === "setPoint")!;
    expect(cat.score).toBeNull();
  });
});
