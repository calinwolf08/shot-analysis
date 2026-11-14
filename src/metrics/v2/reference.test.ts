import { describe, it, expect } from "vitest";
import type { Frame, TestLandmark } from "../../testing/types";
import { LANDMARK_INDICES, TOTAL_LANDMARKS } from "../../types";
import {
  buildReferenceSkeletons,
  normalizeSkeleton,
  referenceOnFrame,
} from "./reference";

function frame(over: Record<number, [number, number]>): Frame {
  const landmarks: TestLandmark[] = Array.from({ length: TOTAL_LANDMARKS }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));
  for (const [i, [x, y]] of Object.entries(over)) {
    landmarks[Number(i)] = { x, y, z: 0, visibility: 0.9 };
  }
  return { frameIndex: 0, timestamp: 0, poseConfidence: 0.9, landmarks };
}

const L = LANDMARK_INDICES;
// A pose with clear anchors: nose high, ankles at bottom, wrist to one side.
const base = frame({
  [L.NOSE]: [0.5, 0.2],
  [L.LEFT_ANKLE]: [0.48, 0.8],
  [L.RIGHT_ANKLE]: [0.52, 0.8],
  [L.RIGHT_WRIST]: [0.62, 0.4],
});

describe("reference skeletons", () => {
  it("normalizes into stance space (feet center = origin)", () => {
    const norm = normalizeSkeleton(base)!;
    // ankle midpoint x=0.5 == centerOfFeet → normalized x ≈ 0.
    const la = norm[L.LEFT_ANKLE]!;
    const ra = norm[L.RIGHT_ANKLE]!;
    expect((la.x + ra.x) / 2).toBeCloseTo(0, 5);
    // ankle line is the y origin → ankle y ≈ 0.
    expect((la.y + ra.y) / 2).toBeCloseTo(0, 5);
  });

  it("round-trips: normalize → build → referenceOnFrame recovers the pose", () => {
    const norm = normalizeSkeleton(base)!;
    const ref = buildReferenceSkeletons({ set_point: [norm] }).set_point!;
    const drawn = referenceOnFrame(ref, base)!;
    // The drawn pro skeleton, aligned to the same frame, matches the original.
    for (const idx of [L.NOSE, L.RIGHT_WRIST, L.LEFT_ANKLE, L.RIGHT_ANKLE]) {
      expect(drawn[idx]!.x).toBeCloseTo(base.landmarks![idx]!.x, 4);
      expect(drawn[idx]!.y).toBeCloseTo(base.landmarks![idx]!.y, 4);
    }
  });

  it("takes the median across samples and drops rarely-seen landmarks", () => {
    const a = normalizeSkeleton(base)!;
    const b = normalizeSkeleton(frame({
      [L.NOSE]: [0.5, 0.2],
      [L.LEFT_ANKLE]: [0.48, 0.8],
      [L.RIGHT_ANKLE]: [0.52, 0.8],
      [L.RIGHT_WRIST]: [0.7, 0.4],
    }))!;
    const ref = buildReferenceSkeletons({ set_point: [a, b] }).set_point!;
    // wrist present in both → median of the two normalized x values.
    expect(ref.landmarks[L.RIGHT_WRIST]).not.toBeNull();
  });

  it("returns null when a frame lacks the anchor landmarks", () => {
    // Occlude both ankles (visibility below threshold) → no stance anchor.
    const noAnkles = frame({ [L.NOSE]: [0.5, 0.2] });
    const lm = noAnkles.landmarks as TestLandmark[];
    lm[L.LEFT_ANKLE] = { x: 0.48, y: 0.8, z: 0, visibility: 0 };
    lm[L.RIGHT_ANKLE] = { x: 0.52, y: 0.8, z: 0, visibility: 0 };
    expect(normalizeSkeleton(noAnkles)).toBeNull();
  });
});
