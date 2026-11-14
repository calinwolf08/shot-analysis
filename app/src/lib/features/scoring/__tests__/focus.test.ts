import { describe, expect, it } from "vitest";
import type { MetricDeviation } from "../deviation";
import {
  FOCUS_AREAS,
  focusSummary,
  metricMatchesAreas,
  normalizeAreas,
  selectFocusWorst,
} from "../focus";

const m = (
  id: string,
  normDev: number,
  inBand = false,
  scored = true,
): MetricDeviation =>
  ({ id, normDev, inBand, scored, label: id }) as unknown as MetricDeviation;

describe("metricMatchesAreas", () => {
  it("matches metrics to their area", () => {
    expect(metricMatchesAreas("setPoint.elbow_flare", ["set-point"])).toBe(
      true,
    );
    expect(metricMatchesAreas("setPoint.elbow_flare", ["elbow"])).toBe(true);
    expect(
      metricMatchesAreas("followThrough.wrist_snap_angle", ["follow-through"]),
    ).toBe(true);
    expect(metricMatchesAreas("seq.set_point__legs_extend", ["rhythm"])).toBe(
      true,
    );
    expect(metricMatchesAreas("gather.head", ["head"])).toBe(true);
    expect(metricMatchesAreas("load.depth_drop", ["load-depth"])).toBe(true);
    expect(metricMatchesAreas("gather.hips", ["base-balance"])).toBe(true);
  });

  it("does not match unrelated areas", () => {
    expect(metricMatchesAreas("followThrough.wrist_snap_angle", ["head"])).toBe(
      false,
    );
    expect(metricMatchesAreas("seq.a__b", ["base-balance"])).toBe(false);
    expect(metricMatchesAreas("release.knees_end", [])).toBe(false);
  });
});

describe("selectFocusWorst", () => {
  const all = [
    m("setPoint.elbow_flare", 3.0),
    m("followThrough.wrist_snap_angle", 5.0),
    m("gather.head", 1.0, true), // in band → excluded
    m("release.knees_end", 4.0),
    m("gather.hips", 2.0),
  ];

  it("returns null when nothing is selected (caller uses global worst)", () => {
    expect(selectFocusWorst(all, [])).toBeNull();
  });

  it("returns only off-target metrics in the selected areas, worst first", () => {
    const r = selectFocusWorst(all, ["set-point", "follow-through"])!;
    expect(r.map((x) => x.id)).toEqual([
      "followThrough.wrist_snap_angle",
      "setPoint.elbow_flare",
    ]);
  });

  it("excludes in-band and respects max", () => {
    const r = selectFocusWorst(all, ["head"]);
    expect(r).toEqual([]); // only gather.head matches, but it is in band
    const r2 = selectFocusWorst(all, ["set-point", "follow-through"], 1)!;
    expect(r2).toHaveLength(1);
    expect(r2[0]!.id).toBe("followThrough.wrist_snap_angle");
  });
});

describe("focusSummary + normalizeAreas", () => {
  it("summarizes the selection", () => {
    expect(focusSummary([])).toBe("Everything");
    expect(focusSummary(["set-point"])).toBe("Set point");
    expect(focusSummary(["set-point", "elbow", "head"])).toBe("Set point +2");
  });

  it("drops unknown ids and keeps canonical order", () => {
    expect(normalizeAreas(["bogus", "head", "set-point"])).toEqual([
      "set-point",
      "head",
    ]);
  });

  it("every area has a label + hint", () => {
    for (const a of FOCUS_AREAS) {
      expect(a.label).toBeTruthy();
      expect(a.hint).toBeTruthy();
    }
  });
});
