import { describe, it, expect } from "vitest";
import type { Frame, TestLandmark } from "../../testing/types";
import { LANDMARK_INDICES } from "../../types";
import {
  MIN_VISIBILITY,
  normTime,
  bodyScaleY,
  centerOfFeetX,
  ankleLineY,
  isSideView,
  orientationSign,
  forwardOffset,
  heightAboveFeet,
} from "./normalize";

const L = LANDMARK_INDICES;

/** Build a 33-landmark frame; caller overrides specific joints with [x,y,vis?]. */
function frame(overrides: Record<number, [number, number, number?]>): Frame {
  const landmarks: TestLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));
  for (const [idx, [x, y, vis]] of Object.entries(overrides)) {
    landmarks[Number(idx)] = { x, y, z: 0, visibility: vis ?? 0.9 };
  }
  return { frameIndex: 0, timestamp: 0, poseConfidence: 0.9, landmarks };
}

describe("normTime", () => {
  it("maps the endpoints to 0 and 1", () => {
    expect(normTime(10, 10, 20)).toBe(0);
    expect(normTime(20, 10, 20)).toBe(1);
  });

  it("interpolates linearly in between", () => {
    expect(normTime(15, 10, 20)).toBeCloseTo(0.5, 10);
    expect(normTime(12, 10, 20)).toBeCloseTo(0.2, 10);
  });

  it("returns 0 for a zero- or negative-length span", () => {
    expect(normTime(10, 10, 10)).toBe(0);
    expect(normTime(15, 20, 10)).toBe(0);
  });

  it("extrapolates outside the range rather than clamping", () => {
    expect(normTime(5, 10, 20)).toBeCloseTo(-0.5, 10);
    expect(normTime(25, 10, 20)).toBeCloseTo(1.5, 10);
  });
});

describe("bodyScaleY", () => {
  it("is the vertical nose→ankle-midpoint span", () => {
    const f = frame({
      [L.NOSE]: [0.5, 0.1],
      [L.LEFT_ANKLE]: [0.48, 0.9],
      [L.RIGHT_ANKLE]: [0.52, 0.9],
    });
    expect(bodyScaleY(f)).toBeCloseTo(0.8, 10);
  });

  it("uses whichever single ankle is visible", () => {
    const f = frame({
      [L.NOSE]: [0.5, 0.1],
      [L.LEFT_ANKLE]: [0.48, 0.7],
      [L.RIGHT_ANKLE]: [0.52, 0.9, 0], // occluded
    });
    expect(bodyScaleY(f)).toBeCloseTo(0.6, 10);
  });

  it("returns null when the nose is not visible", () => {
    const f = frame({
      [L.NOSE]: [0.5, 0.1, 0],
      [L.LEFT_ANKLE]: [0.48, 0.9],
      [L.RIGHT_ANKLE]: [0.52, 0.9],
    });
    expect(bodyScaleY(f)).toBeNull();
  });

  it("returns null when neither ankle is visible", () => {
    const f = frame({
      [L.NOSE]: [0.5, 0.1],
      [L.LEFT_ANKLE]: [0.48, 0.9, 0],
      [L.RIGHT_ANKLE]: [0.52, 0.9, 0],
    });
    expect(bodyScaleY(f)).toBeNull();
  });

  it("returns null for a degenerate (near-zero) span", () => {
    const f = frame({
      [L.NOSE]: [0.5, 0.5],
      [L.LEFT_ANKLE]: [0.48, 0.5001],
      [L.RIGHT_ANKLE]: [0.52, 0.5001],
    });
    expect(bodyScaleY(f)).toBeNull();
  });
});

describe("centerOfFeetX / ankleLineY", () => {
  it("average both ankles when visible", () => {
    const f = frame({
      [L.LEFT_ANKLE]: [0.4, 0.8],
      [L.RIGHT_ANKLE]: [0.6, 0.9],
    });
    expect(centerOfFeetX(f)).toBeCloseTo(0.5, 10);
    expect(ankleLineY(f)).toBeCloseTo(0.85, 10);
  });

  it("fall back to the single visible ankle", () => {
    const f = frame({
      [L.LEFT_ANKLE]: [0.4, 0.8],
      [L.RIGHT_ANKLE]: [0.6, 0.9, 0],
    });
    expect(centerOfFeetX(f)).toBeCloseTo(0.4, 10);
    expect(ankleLineY(f)).toBeCloseTo(0.8, 10);
  });

  it("return null when neither ankle is visible", () => {
    const f = frame({
      [L.LEFT_ANKLE]: [0.4, 0.8, 0],
      [L.RIGHT_ANKLE]: [0.6, 0.9, 0],
    });
    expect(centerOfFeetX(f)).toBeNull();
    expect(ankleLineY(f)).toBeNull();
  });
});

describe("isSideView / orientationSign", () => {
  it("treats only side-left / side-right as side views", () => {
    expect(isSideView("side-left")).toBe(true);
    expect(isSideView("side-right")).toBe(true);
    expect(isSideView("front")).toBe(false);
    expect(isSideView("behind")).toBe(false);
    expect(isSideView("unknown")).toBe(false);
  });

  it("signs side-left +1, side-right -1, and everything else 0", () => {
    expect(orientationSign("side-left")).toBe(1);
    expect(orientationSign("side-right")).toBe(-1);
    expect(orientationSign("front")).toBe(0);
    expect(orientationSign("behind")).toBe(0);
  });
});

describe("forwardOffset", () => {
  const base = {
    [L.NOSE]: [0.5, 0.1] as [number, number],
    [L.LEFT_ANKLE]: [0.48, 0.9] as [number, number],
    [L.RIGHT_ANKLE]: [0.52, 0.9] as [number, number],
  };

  it("is signed so 'toward the hoop' is positive regardless of side", () => {
    // Joint at x=0.7, feet center at 0.5, scale = 0.8 → raw offset 0.25.
    const f = frame({ ...base, [L.LEFT_WRIST]: [0.7, 0.4] });
    // side-left: sign +1 → +0.25 (shooter faces screen-right, +X is forward)
    expect(forwardOffset(f, L.LEFT_WRIST, "side-left")).toBeCloseTo(0.25, 6);
    // side-right: sign -1 → -0.25
    expect(forwardOffset(f, L.LEFT_WRIST, "side-right")).toBeCloseTo(-0.25, 6);
  });

  it("returns null for non-side orientations (sign 0)", () => {
    const f = frame({ ...base, [L.LEFT_WRIST]: [0.7, 0.4] });
    expect(forwardOffset(f, L.LEFT_WRIST, "front")).toBeNull();
  });

  it("returns null when the joint is not visible", () => {
    const f = frame({ ...base, [L.LEFT_WRIST]: [0.7, 0.4, 0] });
    expect(forwardOffset(f, L.LEFT_WRIST, "side-left")).toBeNull();
  });

  it("returns null when body scale is unavailable", () => {
    const f = frame({
      [L.LEFT_ANKLE]: [0.48, 0.9],
      [L.RIGHT_ANKLE]: [0.52, 0.9],
      [L.LEFT_WRIST]: [0.7, 0.4],
      // no nose → no body scale
      [L.NOSE]: [0.5, 0.1, 0],
    });
    expect(forwardOffset(f, L.LEFT_WRIST, "side-left")).toBeNull();
  });
});

describe("heightAboveFeet", () => {
  it("is positive above the ankle line and body-scaled", () => {
    const f = frame({
      [L.NOSE]: [0.5, 0.1],
      [L.LEFT_ANKLE]: [0.48, 0.9],
      [L.RIGHT_ANKLE]: [0.52, 0.9],
      [L.LEFT_WRIST]: [0.6, 0.5], // 0.4 above the ankle line, scale 0.8
    });
    expect(heightAboveFeet(f, L.LEFT_WRIST)).toBeCloseTo(0.5, 6);
  });

  it("is negative below the ankle line", () => {
    const f = frame({
      [L.NOSE]: [0.5, 0.1],
      [L.LEFT_ANKLE]: [0.48, 0.9],
      [L.RIGHT_ANKLE]: [0.52, 0.9],
      [L.LEFT_WRIST]: [0.6, 0.98],
    });
    expect(heightAboveFeet(f, L.LEFT_WRIST)!).toBeLessThan(0);
  });

  it("returns null when the joint is not visible", () => {
    const f = frame({
      [L.NOSE]: [0.5, 0.1],
      [L.LEFT_ANKLE]: [0.48, 0.9],
      [L.RIGHT_ANKLE]: [0.52, 0.9],
      [L.LEFT_WRIST]: [0.6, 0.5, 0],
    });
    expect(heightAboveFeet(f, L.LEFT_WRIST)).toBeNull();
  });

  it("returns null when there is no ankle line", () => {
    const f = frame({
      [L.NOSE]: [0.5, 0.1],
      [L.LEFT_ANKLE]: [0.48, 0.9, 0],
      [L.RIGHT_ANKLE]: [0.52, 0.9, 0],
      [L.LEFT_WRIST]: [0.6, 0.5],
    });
    expect(heightAboveFeet(f, L.LEFT_WRIST)).toBeNull();
  });
});

describe("visibility gating", () => {
  it("treats a landmark exactly at MIN_VISIBILITY as usable but just below as not", () => {
    const usable = frame({
      [L.NOSE]: [0.5, 0.1, MIN_VISIBILITY],
      [L.LEFT_ANKLE]: [0.48, 0.9],
      [L.RIGHT_ANKLE]: [0.52, 0.9],
    });
    expect(bodyScaleY(usable)).not.toBeNull();

    const gated = frame({
      [L.NOSE]: [0.5, 0.1, MIN_VISIBILITY - 0.01],
      [L.LEFT_ANKLE]: [0.48, 0.9],
      [L.RIGHT_ANKLE]: [0.52, 0.9],
    });
    expect(bodyScaleY(gated)).toBeNull();
  });
});
