import { describe, expect, it } from "vitest";
import type { LandmarkFrame } from "$lib/features/analysis";
import {
  CAMERA_ANGLE_WARN,
  createCameraAngleMonitor,
} from "../camera-angle-check";

/** A standing body seen `deg` off side-on (square canvas). */
function frame(i: number, deg: number): LandmarkFrame {
  const s = Math.sin((deg * Math.PI) / 180);
  const torso = 0.25;
  const lm = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
  }));
  const put = (j: number, x: number, y: number) =>
    (lm[j] = { x, y, visibility: 0.9 });
  // Shoulder width 0.8 × torso, hip width 0.5 × torso when front-on.
  put(11, 0.5 - 0.4 * torso * s, 0.3);
  put(12, 0.5 + 0.4 * torso * s, 0.3);
  put(23, 0.5 - 0.25 * torso * s, 0.3 + torso);
  put(24, 0.5 + 0.25 * torso * s, 0.3 + torso);
  return { frameIndex: i, timestamp: i * 33, poseConfidence: 1, landmarks: lm };
}

describe("camera angle monitor", () => {
  it("needs a few frames, then estimates the angle", () => {
    const m = createCameraAngleMonitor({ minFrames: 5, every: 1 });
    expect(m.push(frame(0, 30), 1)).toBeNull();
    let a: number | null = null;
    for (let i = 1; i < 10; i++) a = m.push(frame(i, 30), 1);
    expect(a).toBeCloseTo(30, 0);
    expect(a!).toBeGreaterThan(CAMERA_ANGLE_WARN);
  });

  it("near side-on stays under the warning; reset clears", () => {
    const m = createCameraAngleMonitor({ minFrames: 5, every: 1 });
    let a: number | null = null;
    for (let i = 0; i < 10; i++) a = m.push(frame(i, 8), 1);
    expect(a!).toBeLessThan(CAMERA_ANGLE_WARN);
    m.reset();
    expect(m.push(frame(0, 8), 1)).toBeNull();
  });
});
