import { describe, expect, it } from "vitest";
import {
  FEEDBACK_COUNT,
  buildCueReadback,
  feedbackItems,
  inPhaseOrder,
  phaseName,
} from "../readback";

const item = (id: string, cue: string | null = `cue ${id}`) => ({
  id,
  phase: id.split(".")[0]!,
  label: `label ${id}`,
  cue,
});

describe("feedbackItems", () => {
  it("takes the 3 worst, then puts them in shot order", () => {
    expect(FEEDBACK_COUNT).toBe(3);
    const worst = [
      item("release.wrist_snap"),
      item("load.knee_depth"),
      item("setPoint.elbow_angle"),
      item("rise.t_start"), // 4th worst: dropped
    ];
    expect(feedbackItems(worst).map((m) => m.id)).toEqual([
      "load.knee_depth",
      "setPoint.elbow_angle",
      "release.wrist_snap",
    ]);
  });

  it("is stable within a phase and puts unknown phases last", () => {
    const xs = [item("x.a"), item("load.b"), item("load.c")];
    expect(inPhaseOrder(xs).map((m) => m.id)).toEqual([
      "load.b",
      "load.c",
      "x.a",
    ]);
  });
});

describe("buildCueReadback", () => {
  it("speaks cues grouped under their phase name", () => {
    expect(
      buildCueReadback([
        item("load.knee_depth", "Bend your knees more"),
        item("load.ball_drop", "Dip the ball lower"),
        item("setPoint.wrist_vs_head", "Raise your set point"),
      ]),
    ).toBe(
      "Load: Bend your knees more. Dip the ball lower. Set point: Raise your set point.",
    );
  });

  it("falls back to the label without a cue; empty → empty", () => {
    expect(buildCueReadback([item("rise.t_end", null)])).toBe(
      "Rise: label rise.t_end.",
    );
    expect(buildCueReadback([])).toBe("");
  });

  it("names phases for people", () => {
    expect(phaseName("setPoint")).toBe("Set point");
    expect(phaseName("other")).toBe("other");
  });
});
