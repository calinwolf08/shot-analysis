import { describe, expect, it } from "vitest";
import type { LandmarkFrame } from "$lib/features/analysis";
import {
  CUE_TEXT,
  createReadinessGate,
  selectReadinessCue,
} from "../readiness";

describe("selectReadinessCue", () => {
  it("resolves full-body before orientation", () => {
    expect(selectReadinessCue(false, false)).toBe("full-body");
    expect(selectReadinessCue(false, true)).toBe("full-body");
  });
  it("asks for orientation once the body is in frame", () => {
    expect(selectReadinessCue(true, false)).toBe("orientation");
  });
  it("is positioned (null) when both pass", () => {
    expect(selectReadinessCue(true, true)).toBeNull();
    expect(CUE_TEXT["full-body"]).toBeTruthy();
    expect(CUE_TEXT.orientation).toBeTruthy();
  });
});

describe("createReadinessGate", () => {
  const emptyFrame = (ts: number): LandmarkFrame =>
    ({
      landmarks: null,
      timestamp: ts,
      frameIndex: ts,
    }) as unknown as LandmarkFrame;

  it("is not positioned and asks for full-body when no pose is visible", () => {
    const gate = createReadinessGate({
      requiredOrientation: "side-left",
      fps: 30,
    });
    const state = gate.update(emptyFrame(0));
    expect(state.positioned).toBe(false);
    expect(state.cue).toBe("full-body");
  });

  it("reset clears the sustained hold", () => {
    const gate = createReadinessGate({
      requiredOrientation: "side-left",
      fps: 30,
    });
    gate.update(emptyFrame(0));
    gate.reset();
    expect(gate.update(emptyFrame(10)).cue).toBe("full-body");
  });
});
