import { describe, expect, it } from "vitest";
import type { LandmarkFrame } from "$lib/features/analysis";
import { scriptFrames } from "$lib/features/analysis/replay/positioning-script";
import {
  CUE_TEXT,
  createReadinessGate,
  selectReadinessCue,
} from "../readiness";

describe("selectReadinessCue", () => {
  it("resolves full-body before orientation", () => {
    expect(selectReadinessCue(false, "front", false)).toBe("full-body");
    expect(selectReadinessCue(false, "side-right", true)).toBe("full-body");
  });
  it("asks to turn side-on when facing the camera or unreadable", () => {
    expect(selectReadinessCue(true, "front", false)).toBe("side-on");
    expect(selectReadinessCue(true, "unknown", false)).toBe("side-on");
  });
  it("asks to turn around when side-on on the wrong side", () => {
    expect(selectReadinessCue(true, "side-left", false)).toBe("turn-around");
  });
  it("is positioned (null) when both pass", () => {
    expect(selectReadinessCue(true, "side-right", true)).toBeNull();
    for (const text of Object.values(CUE_TEXT)) expect(text).toBeTruthy();
  });
});

/** Feeds a scripted stream through a gate; returns the final state. */
function run(spec: Parameters<typeof scriptFrames>[0], hand: "left" | "right") {
  const gate = createReadinessGate({
    requiredOrientation: hand === "right" ? "side-right" : "side-left",
  });
  const frames = scriptFrames(spec, 30, hand);
  let last = gate.update(frames[0]!);
  for (const f of frames.slice(1)) last = gate.update(f);
  return last;
}

describe("createReadinessGate", () => {
  const emptyFrame = (ts: number): LandmarkFrame => ({
    landmarks: null,
    timestamp: ts,
    frameIndex: ts,
    poseConfidence: 0,
  });

  it("is not positioned and asks for full-body when no pose is visible", () => {
    const gate = createReadinessGate({ requiredOrientation: "side-right" });
    const state = gate.update(emptyFrame(0));
    expect(state.positioned).toBe(false);
    expect(state.cue).toBe("full-body");
  });

  it("reset clears the sustained hold", () => {
    const gate = createReadinessGate({ requiredOrientation: "side-right" });
    gate.update(emptyFrame(0));
    gate.reset();
    expect(gate.update(emptyFrame(10)).cue).toBe("full-body");
  });

  // Regression for the reported loop: side-on with the far side occluded used
  // to fail "whole body" ("step back"), and facing the camera then failed the
  // angle ("turn") — the gate could never pass.
  it("passes side-on with the far side occluded (shooting arm nearest)", () => {
    const s = run([{ kind: "side", seconds: 2 }], "right");
    expect(s.fullBodyOk).toBe(true);
    expect(s.detected).toBe("side-right");
    expect(s.positioned).toBe(true);
  });

  it("mirrors for a left-handed shooter", () => {
    expect(run([{ kind: "side", seconds: 2 }], "left").positioned).toBe(true);
  });

  it("asks to turn side-on (not step back) when facing the camera", () => {
    const s = run([{ kind: "facing", seconds: 2 }], "right");
    expect(s.fullBodyOk).toBe(true);
    expect(s.cue).toBe("side-on");
  });

  it("asks to turn around when the guide arm faces the camera", () => {
    expect(run([{ kind: "wrongside", seconds: 2 }], "right").cue).toBe(
      "turn-around",
    );
  });

  it("asks to step back only when the feet are actually cut off", () => {
    expect(run([{ kind: "cutoff", seconds: 2 }], "right").cue).toBe(
      "full-body",
    );
  });

  it("needs the full-body hold before passing", () => {
    // 0.5 s < the 1 s default hold.
    const s = run([{ kind: "side", seconds: 0.5 }], "right");
    expect(s.positioned).toBe(false);
    expect(s.cue).toBe("full-body");
  });
});
