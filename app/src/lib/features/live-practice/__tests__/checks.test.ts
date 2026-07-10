import { describe, expect, it } from "vitest";
import type { LandmarkFrame } from "$lib/features/analysis";
import {
  CHECK_DEFAULTS,
  createSustainedCheck,
  isFullBodyVisible,
  isLightingOk,
  isSideView,
  isStable,
  meanLuma,
} from "../setup/checks";
import {
  makeCursor,
  noPose,
  stillPose,
} from "../coordinator/synthetic-streams";

function posedFrame(): LandmarkFrame {
  return stillPose(makeCursor(), 34)[0]!;
}

describe("isFullBodyVisible", () => {
  it("passes a full synthetic pose", () => {
    expect(isFullBodyVisible(posedFrame())).toBe(true);
  });

  it("fails with no pose or a hidden key landmark", () => {
    expect(isFullBodyVisible(noPose(makeCursor(), 34)[0]!)).toBe(false);

    const frame = posedFrame();
    const landmarks = [...frame.landmarks!];
    landmarks[27] = { ...landmarks[27]!, visibility: 0.1 }; // left ankle
    expect(isFullBodyVisible({ ...frame, landmarks })).toBe(false);
  });

  it("fails when landmarks are truncated below the ankles", () => {
    const frame = posedFrame();
    expect(
      isFullBodyVisible({ ...frame, landmarks: frame.landmarks!.slice(0, 20) }),
    ).toBe(false);
  });
});

describe("createSustainedCheck", () => {
  it("passes only after the signal holds for the window", () => {
    const check = createSustainedCheck(2000);
    expect(check.update(true, 0)).toBe(false);
    expect(check.update(true, 1000)).toBe(false);
    expect(check.update(true, 2000)).toBe(true);
  });

  it("resets when the signal drops longer than the grace window", () => {
    const check = createSustainedCheck(2000, 250);
    check.update(true, 0);
    check.update(true, 1000);
    expect(check.update(false, 1400)).toBe(false); // 400 ms drop > grace
    expect(check.update(true, 1500)).toBe(false); // hold restarts here
    expect(check.update(true, 3499)).toBe(false);
    expect(check.update(true, 3500)).toBe(true);
  });

  it("rides through flickers shorter than the grace window", () => {
    const check = createSustainedCheck(2000, 250);
    check.update(true, 0);
    check.update(true, 950);
    expect(check.update(false, 1000)).toBe(false); // 50 ms flicker
    expect(check.update(true, 1100)).toBe(false); // within grace → hold kept
    expect(check.update(true, 2000)).toBe(true);
    check.reset();
    expect(check.update(true, 2100)).toBe(false);
  });
});

describe("isSideView", () => {
  it("passes when shoulders overlap horizontally (profile)", () => {
    const frames = stillPose(makeCursor(), 500); // synthetic pose: both x=0.5
    expect(isSideView(frames)).toBe(true);
  });

  it("fails a square-on stance and empty input", () => {
    const frames = stillPose(makeCursor(), 500).map((f) => {
      const landmarks = [...f.landmarks!];
      landmarks[11] = { ...landmarks[11]!, x: 0.35 };
      landmarks[12] = { ...landmarks[12]!, x: 0.65 };
      return { ...f, landmarks };
    });
    expect(isSideView(frames)).toBe(false);
    expect(isSideView([])).toBe(false);
    expect(isSideView(noPose(makeCursor(), 200))).toBe(false);
  });
});

describe("lighting", () => {
  function pixels(value: number, count = 16): Uint8ClampedArray {
    const data = new Uint8ClampedArray(count * 4);
    for (let i = 0; i < count; i++) {
      data[i * 4] = value;
      data[i * 4 + 1] = value;
      data[i * 4 + 2] = value;
      data[i * 4 + 3] = 255;
    }
    return data;
  }

  it("computes mean luma of gray frames exactly", () => {
    expect(meanLuma(pixels(128))).toBeCloseTo(128, 0);
    expect(meanLuma(new Uint8ClampedArray(0))).toBe(0);
  });

  it("rejects too-dark and too-bright frames", () => {
    expect(isLightingOk(pixels(10))).toBe(false);
    expect(isLightingOk(pixels(250))).toBe(false);
    expect(isLightingOk(pixels(120))).toBe(true);
  });
});

describe("isStable", () => {
  it("auto-passes with too few samples (web without devicemotion)", () => {
    expect(isStable([])).toBe(true);
    expect(isStable([9.8, 9.8])).toBe(true);
  });

  it("passes steady readings and fails shaky ones", () => {
    expect(isStable([9.8, 9.81, 9.79, 9.8, 9.8, 9.82])).toBe(true);
    expect(isStable([9.8, 11.5, 8.2, 12.0, 7.9, 10.4])).toBe(false);
  });

  it("respects a custom variance bound", () => {
    const samples = [9.8, 10.2, 9.4, 10.1, 9.6];
    expect(isStable(samples, 0.01)).toBe(false);
    expect(isStable(samples, 5)).toBe(true);
  });
});

describe("defaults", () => {
  it("keeps the design-doc sustain window at 2 s", () => {
    expect(CHECK_DEFAULTS.fullBodySustainMs).toBe(2000);
  });
});
