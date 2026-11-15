import { describe, it, expect } from "vitest";
import type { Frame, KeyframeId, TestLandmark } from "../../../testing/types";
import { LANDMARK_INDICES } from "../../../types";
import { computeStructure } from "./index";

// Build a 33-landmark frame; caller overrides specific joints.
function frame(
  frameIndex: number,
  overrides: Record<number, [number, number]>,
): Frame {
  const landmarks: TestLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));
  for (const [idx, [x, y]] of Object.entries(overrides)) {
    landmarks[Number(idx)] = { x, y, z: 0, visibility: 0.9 };
  }
  return { frameIndex, timestamp: frameIndex / 30, poseConfidence: 0.9, landmarks };
}

// A tiny synthetic shot: hips drop then rise, wrists rise. Frames 0..10.
function buildShot(): { frames: Frame[]; keyframes: Map<KeyframeId, number | null> } {
  const L = LANDMARK_INDICES;
  const frames: Frame[] = [];
  for (let i = 0; i <= 10; i++) {
    // hips lowest (highest Y) around frame 4; wrists rise (Y decreases) over time
    const hipY = 0.45 + (i <= 4 ? i * 0.01 : (8 - i) * 0.01);
    const wristY = 0.7 - i * 0.03;
    frames.push(
      frame(i, {
        [L.NOSE]: [0.5, 0.2],
        [L.LEFT_SHOULDER]: [0.45, 0.35],
        [L.RIGHT_SHOULDER]: [0.55, 0.35],
        [L.LEFT_ELBOW]: [0.6, 0.45],
        [L.RIGHT_ELBOW]: [0.6, 0.45],
        [L.LEFT_WRIST]: [0.62, wristY],
        [L.RIGHT_WRIST]: [0.62, wristY],
        [L.LEFT_INDEX]: [0.64, wristY - 0.02],
        [L.RIGHT_INDEX]: [0.64, wristY - 0.02],
        [L.LEFT_HIP]: [0.47, hipY],
        [L.RIGHT_HIP]: [0.53, hipY],
        [L.LEFT_KNEE]: [0.47, 0.6],
        [L.RIGHT_KNEE]: [0.53, 0.6],
        [L.LEFT_ANKLE]: [0.48, 0.85],
        [L.RIGHT_ANKLE]: [0.52, 0.85],
      }),
    );
  }
  const keyframes = new Map<KeyframeId, number | null>([
    ["legs_start_bending", 0],
    ["ball_low_point", 3],
    ["leg_bend_low_point", 4],
    ["legs_start_extending", 5],
    ["ball_starts_upward", 4],
    ["set_point", 7],
    ["legs_fully_extended", 8],
    ["release", 9],
    ["arms_fully_extended", 10],
  ]);
  return { frames, keyframes };
}

describe("computeStructure", () => {
  const { frames, keyframes } = buildShot();

  it("populates every phase for a side view", () => {
    const s = computeStructure(frames, keyframes, {
      startFrame: 0,
      endFrame: 10,
      cameraOrientation: "side-left",
      shootingHand: "right",
    });
    expect(s.gather).toBeDefined();
    expect(s.load).toBeDefined();
    expect(s.rise).toBeDefined();
    expect(s.setPoint).toBeDefined();
    expect(s.release).toBeDefined();
    expect(s.followThrough).toBeDefined();
  });

  it("measures load depth and wrist setup reliably on a side view", () => {
    const s = computeStructure(frames, keyframes, {
      startFrame: 0,
      endFrame: 10,
      cameraOrientation: "side-left",
      shootingHand: "right",
    });
    // hips start higher than the deepest point → positive depth drop.
    expect(s.load!.depth_drop!.reliable).toBe(true);
    expect(s.load!.depth_drop!.value).toBeGreaterThan(0);
    // wrist rises through the load → positive height delta.
    expect(s.load!.wrist_height_delta!.reliable).toBe(true);
    expect(s.load!.wrist_height_delta!.value).toBeGreaterThan(0);
  });

  it("tags posture unavailable on a front view (no side axis)", () => {
    const s = computeStructure(frames, keyframes, {
      startFrame: 0,
      endFrame: 10,
      cameraOrientation: "front",
      shootingHand: "right",
    });
    // Posture offsets require a side view.
    expect(s.load!.hips_delta!.reliable).toBe(false);
    expect(s.gather!.head!.reliable).toBe(false);
    // Non-posture metrics (height/depth) are still measurable from a front view.
    expect(s.load!.wrist_height_delta!.reliable).toBe(true);
  });

  it("omits phases whose bounding keyframes are missing", () => {
    const kf = new Map<KeyframeId, number | null>([
      ["legs_start_bending", 0],
      ["leg_bend_low_point", 4],
      // no set_point → rise (…→set_point) and setPoint snapshot unavailable
    ]);
    const s = computeStructure(frames, kf, {
      startFrame: 0,
      endFrame: 10,
      cameraOrientation: "side-left",
      shootingHand: "right",
    });
    expect(s.load).toBeDefined();
    expect(s.rise).toBeUndefined();
    expect(s.setPoint).toBeUndefined();
  });
});
