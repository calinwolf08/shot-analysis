import { describe, it, expect } from "vitest";
import type { Frame, TestLandmark } from "../../../testing/types";
import { LANDMARK_INDICES } from "../../../types";
import {
  pt,
  jointAngle,
  shoulderWidth,
  wristSeparation,
  armIndices,
  wristCockAngle,
  elbowAngle,
} from "./geometry";

const L = LANDMARK_INDICES;

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

describe("pt", () => {
  it("returns the landmark when visible enough", () => {
    const f = frame({ [L.NOSE]: [0.4, 0.3] });
    expect(pt(f, L.NOSE)).toMatchObject({ x: 0.4, y: 0.3 });
  });

  it("returns null when the landmark is below the visibility floor", () => {
    const f = frame({ [L.NOSE]: [0.4, 0.3, 0.1] });
    expect(pt(f, L.NOSE)).toBeNull();
  });

  it("returns null when landmarks are missing", () => {
    const f: Frame = {
      frameIndex: 0,
      timestamp: 0,
      poseConfidence: 0,
      landmarks: [],
    };
    expect(pt(f, L.NOSE)).toBeNull();
  });
});

describe("jointAngle", () => {
  it("computes a right angle for perpendicular limbs", () => {
    // vertex at origin, a straight up, c straight right → 90°
    const f = frame({
      1: [0.5, 0.3], // a
      2: [0.5, 0.5], // vertex
      3: [0.7, 0.5], // c
    });
    expect(jointAngle(f, 1, 2, 3)).toBeCloseTo(90, 4);
  });

  it("computes 180° for a straight line", () => {
    const f = frame({
      1: [0.3, 0.5],
      2: [0.5, 0.5],
      3: [0.7, 0.5],
    });
    expect(jointAngle(f, 1, 2, 3)).toBeCloseTo(180, 4);
  });

  it("returns null when any of the three points is occluded", () => {
    const f = frame({
      1: [0.5, 0.3, 0],
      2: [0.5, 0.5],
      3: [0.7, 0.5],
    });
    expect(jointAngle(f, 1, 2, 3)).toBeNull();
  });
});

describe("shoulderWidth / wristSeparation", () => {
  it("measure the 2D distance between the paired landmarks", () => {
    const f = frame({
      [L.LEFT_SHOULDER]: [0.4, 0.5],
      [L.RIGHT_SHOULDER]: [0.7, 0.5],
      [L.LEFT_WRIST]: [0.5, 0.4],
      [L.RIGHT_WRIST]: [0.5, 0.8],
    });
    expect(shoulderWidth(f)).toBeCloseTo(0.3, 10);
    expect(wristSeparation(f)).toBeCloseTo(0.4, 10);
  });

  it("return null when a required landmark is occluded", () => {
    const f = frame({
      [L.LEFT_SHOULDER]: [0.4, 0.5, 0],
      [L.RIGHT_SHOULDER]: [0.7, 0.5],
      [L.LEFT_WRIST]: [0.5, 0.4],
      [L.RIGHT_WRIST]: [0.5, 0.8, 0],
    });
    expect(shoulderWidth(f)).toBeNull();
    expect(wristSeparation(f)).toBeNull();
  });
});

describe("armIndices", () => {
  it("maps the shooting arm to the named hand and the guide arm to the other", () => {
    const right = armIndices("right");
    expect(right.shooting.wrist).toBe(L.RIGHT_WRIST);
    expect(right.guide.wrist).toBe(L.LEFT_WRIST);

    const left = armIndices("left");
    expect(left.shooting.wrist).toBe(L.LEFT_WRIST);
    expect(left.guide.wrist).toBe(L.RIGHT_WRIST);
  });
});

describe("wristCockAngle / elbowAngle", () => {
  it("compute their respective joint angles", () => {
    const arm = armIndices("right").shooting;
    // straight forearm+hand → ~180° cock; bent elbow → measurable elbow angle
    const f = frame({
      [arm.shoulder]: [0.5, 0.3],
      [arm.elbow]: [0.5, 0.5],
      [arm.wrist]: [0.5, 0.7],
      [arm.index]: [0.5, 0.9],
    });
    expect(wristCockAngle(f, arm)).toBeCloseTo(180, 4);
    expect(elbowAngle(f, arm)).toBeCloseTo(180, 4);
  });

  it("return null when hand landmarks are not tracked", () => {
    const arm = armIndices("right").shooting;
    const f = frame({
      [arm.shoulder]: [0.5, 0.3],
      [arm.elbow]: [0.5, 0.5],
      [arm.wrist]: [0.5, 0.7],
      [arm.index]: [0.5, 0.9, 0], // hand landmark untracked
    });
    expect(wristCockAngle(f, arm)).toBeNull();
    // elbow angle does not need the hand, so it is still available
    expect(elbowAngle(f, arm)).toBeCloseTo(180, 4);
  });
});
