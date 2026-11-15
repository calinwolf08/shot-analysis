import { describe, it, expect } from "vitest";
import type { Frame, TestLandmark } from "../../../testing/types";
import { LANDMARK_INDICES } from "../../../types";
import { posturePhase, postureSnapshot, type FrameLookup } from "./posture";
import type { Measurement } from "../types";

const L = LANDMARK_INDICES;

/** Non-null accessor for a metric map (tsconfig has noUncheckedIndexedAccess). */
function m(out: Record<string, Measurement>, key: string): Measurement {
  const v = out[key];
  if (!v) throw new Error(`missing metric ${key}`);
  return v;
}

function frame(
  frameIndex: number,
  overrides: Record<number, [number, number, number?]>,
): Frame {
  const landmarks: TestLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));
  for (const [idx, [x, y, vis]] of Object.entries(overrides)) {
    landmarks[Number(idx)] = { x, y, z: 0, visibility: vis ?? 0.9 };
  }
  return { frameIndex, timestamp: 0, poseConfidence: 0.9, landmarks };
}

// A frame with a full lower/upper body; hips shifted forward by `hipX`.
function bodyFrame(frameIndex: number, hipX: number): Frame {
  return frame(frameIndex, {
    [L.NOSE]: [0.5, 0.1],
    [L.LEFT_SHOULDER]: [0.5, 0.3],
    [L.RIGHT_SHOULDER]: [0.5, 0.3],
    [L.LEFT_HIP]: [hipX, 0.5],
    [L.RIGHT_HIP]: [hipX, 0.5],
    [L.LEFT_KNEE]: [0.5, 0.7],
    [L.RIGHT_KNEE]: [0.5, 0.7],
    [L.LEFT_ANKLE]: [0.5, 0.9],
    [L.RIGHT_ANKLE]: [0.5, 0.9],
  });
}

describe("postureSnapshot", () => {
  it("produces a reliable, signed forward offset per joint on a side view", () => {
    const f = bodyFrame(3, 0.6); // hips 0.1 forward of feet center, scale 0.8
    const lookup: FrameLookup = () => f;
    const out = postureSnapshot(lookup, 3, "side-left");

    expect(m(out, "hips").reliable).toBe(true);
    // side-left sign +1 → +(0.6-0.5)/0.8 = 0.125
    expect(m(out, "hips").value).toBeCloseTo(0.125, 6);
    expect(m(out, "hips").frames).toEqual([3]);

    // head/shoulders/ankles are centered → ~0
    expect(m(out, "head").reliable).toBe(true);
    expect(m(out, "head").value).toBeCloseTo(0, 6);
  });

  it("marks every joint unavailable on a non-side view", () => {
    const f = bodyFrame(3, 0.6);
    const out = postureSnapshot(() => f, 3, "front");
    for (const key of ["head", "shoulders", "hips", "knees", "ankles"]) {
      expect(m(out, key).reliable).toBe(false);
      expect(Number.isNaN(m(out, key).value)).toBe(true);
    }
  });

  it("marks joints unavailable when the frame is missing", () => {
    const out = postureSnapshot(() => null, 3, "side-left");
    expect(m(out, "hips").reliable).toBe(false);
  });

  it("confirms ankles are ~0 by construction (they define the feet center)", () => {
    const f = bodyFrame(3, 0.6);
    const out = postureSnapshot(() => f, 3, "side-left");
    // Documented caveat in follow-up-work 1.2: ankle offset is ~0 vs feet center.
    expect(m(out, "ankles").value).toBeCloseTo(0, 6);
  });
});

describe("posturePhase", () => {
  it("emits start / end / delta per joint on a side view", () => {
    // hips move from 0.55 (start) to 0.65 (end); scale 0.8 → +0.125 delta
    const frames: Record<number, Frame> = {
      2: bodyFrame(2, 0.55),
      6: bodyFrame(6, 0.65),
    };
    const lookup: FrameLookup = (i) => frames[i] ?? null;
    const out = posturePhase(lookup, { start: 2, end: 6 }, "side-left");

    expect(m(out, "hips_start").reliable).toBe(true);
    expect(m(out, "hips_end").reliable).toBe(true);
    expect(m(out, "hips_delta").reliable).toBe(true);
    expect(m(out, "hips_start").value).toBeCloseTo((0.55 - 0.5) / 0.8, 6);
    expect(m(out, "hips_end").value).toBeCloseTo((0.65 - 0.5) / 0.8, 6);
    expect(m(out, "hips_delta").value).toBeCloseTo((0.65 - 0.55) / 0.8, 6);
    expect(m(out, "hips_delta").frames).toEqual([2, 6]);
  });

  it("marks delta unavailable when only one endpoint frame resolves", () => {
    const frames: Record<number, Frame> = { 2: bodyFrame(2, 0.55) };
    const out = posturePhase(
      (i) => frames[i] ?? null,
      { start: 2, end: 6 },
      "side-left",
    );
    expect(m(out, "hips_start").reliable).toBe(true);
    expect(m(out, "hips_end").reliable).toBe(false);
    expect(m(out, "hips_delta").reliable).toBe(false);
  });

  it("marks all joints unavailable on a non-side view", () => {
    const frames: Record<number, Frame> = {
      2: bodyFrame(2, 0.55),
      6: bodyFrame(6, 0.65),
    };
    const out = posturePhase(
      (i) => frames[i] ?? null,
      { start: 2, end: 6 },
      "behind",
    );
    expect(m(out, "hips_start").reliable).toBe(false);
    expect(m(out, "hips_delta").reliable).toBe(false);
  });
});
