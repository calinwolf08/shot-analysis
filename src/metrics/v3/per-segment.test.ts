import { describe, expect, it } from "vitest";
import {
  angle3d,
  computeSignals,
  limbVector3d,
  type SegmentLengths,
  type SignalFrame,
} from "./signals";

const RAD = Math.PI / 180;
type V3 = [number, number, number]; // X forward, Y down, Z body-left→right

/**
 * A body whose near (left) leg and shooting (left) arm are given as 3D
 * points, seen `yaw` off side-on by an orthographic camera:
 * image x = X·cos(yaw) + Z·sin(yaw).
 */
function frames(points: Record<number, V3>, yaw: number, n = 9): SignalFrame[] {
  const c = Math.cos(yaw * RAD);
  const s = Math.sin(yaw * RAD);
  return Array.from({ length: n }, (_, i) => ({
    frameIndex: i,
    timestamp: i / 30,
    landmarks: Array.from({ length: 33 }, (_, j) => {
      const p = points[j];
      return p
        ? {
            x: 0.5 + (p[0] * c + p[2] * s) / 3,
            y: 0.3 + p[1] / 3,
            visibility: 0.95,
          }
        : { x: 0, y: 0, visibility: 0 };
    }),
  }));
}

const TORSO = 0.5;
const THIGH = 0.45;
const SHIN = 0.45;
const UPPER = 0.3;
const FORE = 0.26;
const lengths: SegmentLengths = {
  thigh: THIGH / TORSO,
  shin: SHIN / TORSO,
  upperArm: UPPER / TORSO,
  forearm: FORE / TORSO,
};

/** A body with the knee bent to `knee`° and the thigh turned `out`° out of the side-on plane. */
function body(knee: number, out: number): Record<number, V3> {
  const half = (180 - knee) / 2;
  // Thigh forward-down at `half` from vertical, then rotated `out` toward +Z.
  const tx = THIGH * Math.sin(half * RAD);
  const ty = THIGH * Math.cos(half * RAD);
  const kneeP: V3 = [tx * Math.cos(out * RAD), ty, tx * Math.sin(out * RAD)];
  const sx = SHIN * Math.sin(half * RAD);
  const sy = SHIN * Math.cos(half * RAD);
  const ankle: V3 = [
    kneeP[0] - sx * Math.cos(out * RAD),
    kneeP[1] + sy,
    kneeP[2] - sx * Math.sin(out * RAD),
  ];
  const p: Record<number, V3> = {
    11: [0.05, -TORSO, -0.12], // near shoulder
    12: [0.05, -TORSO, 0.12],
    23: [0, 0, -0.08], // near hip
    24: [0, 0, 0.08],
    25: [kneeP[0], kneeP[1], -0.08 + kneeP[2]],
    26: [kneeP[0], kneeP[1], 0.08],
    27: [ankle[0], ankle[1], -0.08 + ankle[2]],
    28: [ankle[0], ankle[1], 0.08],
    // Shooting (left) arm at a 90° elbow, upper arm out of plane by `out`.
    13: [
      0.05 + UPPER * Math.cos(out * RAD),
      -TORSO,
      -0.12 + UPPER * Math.sin(out * RAD),
    ],
    15: [
      0.05 + UPPER * Math.cos(out * RAD),
      -TORSO - FORE,
      -0.12 + UPPER * Math.sin(out * RAD),
    ],
    0: [0.2, -TORSO - 0.2, 0],
    7: [0.08, -TORSO - 0.2, -0.07],
    8: [0.08, -TORSO - 0.2, 0.07],
  };
  return p;
}

const mid = (xs: (number | null)[]) => xs[Math.floor(xs.length / 2)]!;
const sig = (f: SignalFrame[], cameraAngle: number, segs?: SegmentLengths) =>
  computeSignals(f, {
    aspect: 1,
    shootingHand: "left",
    nearSide: "left",
    cameraAngle,
    ...(segs ? { segmentLengths: segs } : {}),
  });

describe("per-segment 3D knee / elbow angles", () => {
  it("in the side-on plane, matches the camera-angle stretch", () => {
    for (const yaw of [0, 20, 35]) {
      const f = frames(body(120, 0), yaw);
      const planar = mid(sig(f, yaw).kneeAngle);
      const s3 = sig(f, yaw, lengths);
      expect(s3.segments3d).toBe(true);
      expect(mid(s3.kneeAngle)).toBeCloseTo(120, 0);
      expect(mid(s3.kneeAngle)).toBeCloseTo(planar, 0);
    }
  });

  it("recovers a knee turned out of the plane, where the stretch can't", () => {
    // Side-on camera, a 90° knee with thigh / shin turned 45° out (knees
    // pushing out): each limb looks ~13% short.
    const f = frames(body(90, 45), 0);
    const planar = mid(sig(f, 0).kneeAngle);
    const s3 = mid(sig(f, 0, lengths).kneeAngle);
    expect(Math.abs(planar - 90)).toBeGreaterThan(10);
    // Within 1°: the test torso leans slightly, so its measured length is
    // 0.5% longer than the one the limb ratios were taken against.
    expect(Math.abs(s3 - 90)).toBeLessThan(1);
  });

  it("a small turn (limb < 10% short) is left to the stretch — too noisy to trust", () => {
    const f = frames(body(120, 45), 0); // ~6% short
    expect(mid(sig(f, 0, lengths).kneeAngle)).toBeCloseTo(
      mid(sig(f, 0).kneeAngle),
      6,
    );
  });

  it("recovers a flared elbow", () => {
    // Upper arm forward and flared 50° out; forearm up and forward in the
    // side-on plane (a set-point shape).
    const shoulder: V3 = [0.05, -TORSO, -0.12];
    const upper: V3 = [
      UPPER * Math.cos(50 * RAD),
      0,
      UPPER * Math.sin(50 * RAD),
    ];
    const elbowP: V3 = [
      shoulder[0] + upper[0],
      shoulder[1],
      shoulder[2] + upper[2],
    ];
    const fore: V3 = [FORE * Math.sin(30 * RAD), -FORE * Math.cos(30 * RAD), 0];
    const wrist: V3 = [elbowP[0] + fore[0], elbowP[1] + fore[1], elbowP[2]];
    const truth = angle3d(
      { x: -upper[0], y: -upper[1], z: -upper[2] },
      { x: fore[0], y: fore[1], z: fore[2] },
    );
    const f = frames(
      { ...body(120, 0), 11: shoulder, 13: elbowP, 15: wrist },
      0,
    );
    expect(mid(sig(f, 0, lengths).elbowAngle)).toBeCloseTo(truth, 0);
    expect(Math.abs(mid(sig(f, 0).elbowAngle) - truth)).toBeGreaterThan(5);
  });

  it("limbs barely shortened use the side-on default (no noisy depth)", () => {
    const v = limbVector3d(
      { x: 0.3, y: 0.3 },
      Math.hypot(0.3, 0.3) * 1.05,
      Math.tan(10 * RAD),
      1,
    );
    expect(v.z).toBeCloseTo(0.3 * Math.tan(10 * RAD), 9);
    expect(angle3d({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(
      90,
      9,
    );
  });

  it("off by default", () => {
    expect(sig(frames(body(120, 0), 0), 0).segments3d).toBe(false);
  });
});
