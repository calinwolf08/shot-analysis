import { describe, it, expect } from "vitest";
import type { Frame, KeyframeId, TestLandmark } from "../../testing/types";
import { LANDMARK_INDICES } from "../../types";
import { metricsForShot } from "./extract";
import { METRICS_SCHEMA_VERSION } from "./types";

function frame(i: number, over: Record<number, [number, number]>): Frame {
  const landmarks: TestLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));
  for (const [idx, [x, y]] of Object.entries(over)) {
    landmarks[Number(idx)] = { x, y, z: 0, visibility: 0.9 };
  }
  return { frameIndex: i, timestamp: i / 30, poseConfidence: 0.9, landmarks };
}

const L = LANDMARK_INDICES;
const frames: Frame[] = [];
for (let i = 0; i <= 10; i++) {
  frames.push(
    frame(i, {
      [L.NOSE]: [0.5, 0.2],
      [L.LEFT_SHOULDER]: [0.45, 0.35],
      [L.RIGHT_SHOULDER]: [0.55, 0.35],
      [L.LEFT_ELBOW]: [0.6, 0.45],
      [L.RIGHT_ELBOW]: [0.6, 0.45],
      [L.LEFT_WRIST]: [0.62, 0.7 - i * 0.03],
      [L.RIGHT_WRIST]: [0.62, 0.7 - i * 0.03],
      [L.LEFT_INDEX]: [0.64, 0.68 - i * 0.03],
      [L.RIGHT_INDEX]: [0.64, 0.68 - i * 0.03],
      [L.LEFT_HIP]: [0.47, 0.45],
      [L.RIGHT_HIP]: [0.53, 0.45],
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

describe("metricsForShot", () => {
  it("assembles a complete ShotMetricsV2 record", () => {
    const m = metricsForShot(
      frames,
      keyframes,
      { startFrame: 0, endFrame: 10 },
      { fps: 30, cameraOrientation: "side-left", shootingHand: "right", poseConfidence: 0.9 },
    );
    expect(m.schemaVersion).toBe(METRICS_SCHEMA_VERSION);
    expect(m.shot).toEqual({
      startFrame: 0,
      endFrame: 10,
      fps: 30,
      cameraOrientation: "side-left",
    });
    expect(m.reliability.sideView).toBe(true);
    expect(m.reliability.poseConfidence).toBeCloseTo(0.9, 5);
    expect(m.sequencing.events).toHaveLength(8);
    expect(m.sequencing.coverage).toBe(1);
    expect(m.structure?.load).toBeDefined();
    expect(m.structure?.setPoint).toBeDefined();
  });

  it("flags a front view as not a side view", () => {
    const m = metricsForShot(
      frames,
      keyframes,
      { startFrame: 0, endFrame: 10 },
      { fps: 30, cameraOrientation: "front", shootingHand: "right", poseConfidence: 0.5 },
    );
    expect(m.reliability.sideView).toBe(false);
  });
});
