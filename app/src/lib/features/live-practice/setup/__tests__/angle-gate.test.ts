import { describe, expect, it } from "vitest";
import { evaluateAngleGate, requiredOrientation } from "../angle-gate";

describe("requiredOrientation", () => {
  it("puts the shooting arm nearest the camera: side-right for right-handed, side-left for left", () => {
    expect(requiredOrientation("right")).toBe("side-right");
    expect(requiredOrientation("left")).toBe("side-left");
  });
});

describe("evaluateAngleGate", () => {
  it("passes when the detected orientation matches the required side", () => {
    const r = evaluateAngleGate("side-right", "right");
    expect(r.ok).toBe(true);
    expect(r.reason).toBeNull();
    expect(r.required).toBe("side-right");
  });

  it("mirrors for left-handed shooters", () => {
    expect(evaluateAngleGate("side-left", "left").ok).toBe(true);
    expect(evaluateAngleGate("side-right", "left").ok).toBe(false);
  });

  it("asks the user to turn around when side-on but on the wrong side", () => {
    const r = evaluateAngleGate("side-left", "right");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/turn around/i);
  });

  it("asks the user to stand side-on for a non-side orientation", () => {
    const r = evaluateAngleGate("front", "right");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/side-on/i);
  });

  it("guides from an unknown / missing orientation", () => {
    expect(evaluateAngleGate(null, "right").ok).toBe(false);
    expect(evaluateAngleGate("unknown", "right").ok).toBe(false);
  });
});
