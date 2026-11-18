import { describe, expect, it } from "vitest";
import type { ShotMetricsV3 } from "basketball-shot-analysis";
import { phaseAtFrame, phaseMarks } from "../phase-timeline";

const v3 = {
  schemaVersion: 2,
  events: { setPoint: 30.4 },
  phases: {
    load: { start: 10.2, end: 20.6 },
    rise: { start: 20.6, end: 30.4 },
    release: { start: 30.4, end: 34 },
  },
  metrics: {},
  facing: 1,
  nearSide: "right",
} as unknown as ShotMetricsV3;

describe("v3 phase timeline", () => {
  it("marks each phase where it begins, in order", () => {
    expect(phaseMarks(v3)).toEqual([
      { phase: "load", name: "Load", frame: 10 },
      { phase: "rise", name: "Rise", frame: 21 },
      { phase: "setPoint", name: "Set point", frame: 30 },
      { phase: "release", name: "Release", frame: 32 },
    ]);
  });

  it("assigns frames: before/at load → Load, then Rise, Set point ±1, Release", () => {
    expect(phaseAtFrame(v3, 0)).toBe("load");
    expect(phaseAtFrame(v3, 20)).toBe("load");
    expect(phaseAtFrame(v3, 21)).toBe("rise");
    expect(phaseAtFrame(v3, 29)).toBe("rise");
    expect(phaseAtFrame(v3, 30)).toBe("setPoint");
    expect(phaseAtFrame(v3, 31)).toBe("setPoint");
    expect(phaseAtFrame(v3, 32)).toBe("release");
    expect(phaseAtFrame(v3, 99)).toBe("release");
  });

  it("no phases detected → null", () => {
    const none = {
      ...v3,
      events: { setPoint: null },
      phases: { load: null, rise: null, release: null },
    } as unknown as ShotMetricsV3;
    expect(phaseAtFrame(none, 5)).toBeNull();
    expect(phaseMarks(none)).toEqual([]);
  });
});
