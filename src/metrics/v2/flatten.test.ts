import { describe, it, expect } from "vitest";
import { flattenMetrics } from "./flatten";
import { summarize } from "./stats";
import { measure, unavailable, type ShotMetricsV2 } from "./types";

const sample: ShotMetricsV2 = {
  schemaVersion: 1,
  shot: { startFrame: 0, endFrame: 10, fps: 30, cameraOrientation: "side-left" },
  reliability: { poseConfidence: 0.9, sideView: true },
  sequencing: {
    events: [],
    gaps: [
      { from: "ball_low", to: "ball_rise", gap: measure(0.1, [2, 4]) },
      { from: "ball_rise", to: "leg_low", gap: unavailable("Leg low point not detected", []) },
    ],
    coverage: 0.5,
  },
  structure: {
    load: {
      depth_drop: measure(0.07, [4]),
      wrist_cock_start: unavailable("wrist landmarks not tracked"),
    },
    setPoint: { elbow_angle: measure(125, [7]) },
  },
};

describe("flattenMetrics", () => {
  it("flattens sequencing gaps and structure into stable ids", () => {
    const flat = flattenMetrics(sample);
    const ids = flat.map((f) => f.id);
    expect(ids).toContain("seq.ball_low__ball_rise");
    expect(ids).toContain("load.depth_drop");
    expect(ids).toContain("setPoint.elbow_angle");
    const depth = flat.find((f) => f.id === "load.depth_drop")!;
    expect(depth.value).toBeCloseTo(0.07, 5);
    expect(depth.reliable).toBe(true);
  });

  it("carries reliability through so unreliable rows can be excluded", () => {
    const flat = flattenMetrics(sample);
    const cock = flat.find((f) => f.id === "load.wrist_cock_start")!;
    expect(cock.reliable).toBe(false);
    const missingGap = flat.find((f) => f.id === "seq.ball_rise__leg_low")!;
    expect(missingGap.reliable).toBe(false);
    // Only reliable rows would feed thresholds.
    const reliable = flat.filter((f) => f.reliable).map((f) => f.id);
    expect(reliable).not.toContain("load.wrist_cock_start");
  });
});

describe("summarize", () => {
  it("returns median/min/max/IQR for finite values", () => {
    const s = summarize([1, 2, 3, 4, 5])!;
    expect(s.n).toBe(5);
    expect(s.median).toBe(3);
    expect(s.min).toBe(1);
    expect(s.max).toBe(5);
    expect(s.p25).toBe(2);
    expect(s.p75).toBe(4);
    expect(s.iqr).toBe(2);
  });

  it("ignores non-finite values and returns null when empty", () => {
    expect(summarize([NaN, Infinity])).toBeNull();
    const s = summarize([NaN, 10])!;
    expect(s.n).toBe(1);
    expect(s.median).toBe(10);
  });
});
