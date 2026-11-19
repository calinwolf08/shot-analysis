import { describe, expect, it } from "vitest";
import {
  FOCUS_AREAS,
  focusSummary,
  metricMatchesAreas,
  normalizeAreas,
  selectFocusWorst,
} from "../focus";

const m = (id: string, kind = "structure") => ({
  id,
  phase: id.split(".")[0]!,
  kind,
});

describe("focus areas (v3, phase-based)", () => {
  it("one area per phase plus rhythm", () => {
    expect(FOCUS_AREAS.map((a) => a.id)).toEqual([
      "load",
      "rise",
      "set-point",
      "release",
      "rhythm",
    ]);
  });

  it("matches by phase, and rhythm matches timing in any phase", () => {
    expect(metricMatchesAreas(m("load.knee_depth"), ["load"])).toBe(true);
    expect(metricMatchesAreas(m("setPoint.elbow_angle"), ["set-point"])).toBe(
      true,
    );
    expect(metricMatchesAreas(m("setPoint.elbow_angle"), ["release"])).toBe(
      false,
    );
    expect(metricMatchesAreas(m("rise.t_start", "timing"), ["rhythm"])).toBe(
      true,
    );
    expect(metricMatchesAreas(m("rise.t_start", "timing"), ["rise"])).toBe(
      true,
    );
    expect(metricMatchesAreas(m("load.knee_depth"), ["rhythm"])).toBe(false);
    expect(metricMatchesAreas(m("load.knee_depth"), [])).toBe(false);
  });

  it("selectFocusWorst keeps worst-first order within the focus", () => {
    const worst = [
      m("release.wrist_snap"),
      m("rise.t_start", "timing"),
      m("rise.spine_change"),
      m("load.knee_depth"),
    ];
    expect(selectFocusWorst(worst, [])).toBeNull();
    expect(selectFocusWorst(worst, ["rise"])!.map((x) => x.id)).toEqual([
      "rise.t_start",
      "rise.spine_change",
    ]);
    expect(
      selectFocusWorst(worst, ["rise", "load"], 1)!.map((x) => x.id),
    ).toEqual(["rise.t_start"]);
    expect(selectFocusWorst(worst, ["set-point"])).toEqual([]);
  });

  it("normalizeAreas maps legacy ids, drops unknown, canonical order", () => {
    expect(normalizeAreas(["release", "load"])).toEqual(["load", "release"]);
    expect(normalizeAreas(["elbow", "head", "follow-through"])).toEqual([
      "set-point",
      "release",
    ]);
    expect(normalizeAreas(["base-balance", "load-depth", "nope"])).toEqual([
      "load",
    ]);
    expect(normalizeAreas(["rhythm"])).toEqual(["rhythm"]);
  });

  it("focusSummary", () => {
    expect(focusSummary([])).toBe("Everything");
    expect(focusSummary(["set-point"])).toBe("Set point");
    expect(focusSummary(["load", "release"])).toBe("Load +1");
  });
});
