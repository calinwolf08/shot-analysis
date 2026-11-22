import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { DEFAULT_FRONTAL, estimateCameraAngle } from "./camera-angle";
import { estimateProportions } from "./proportions";
import { computeSignals, type SignalFrame } from "./signals";
import { computeShotMetricsV3 } from "./metrics";
import {
  EVENT_PAD_AFTER,
  EVENT_PAD_BEFORE,
  labeledEventFrames,
} from "./labeled";

/**
 * A synthetic body in 3D (metres-ish): X = forward (toward the hoop),
 * Y = down, Z = the body's left→right. Seen by an orthographic camera
 * `yaw` degrees off side-on: image x = X·cos(yaw) + Z·sin(yaw).
 */
const RAD = Math.PI / 180;
interface Body {
  lean: number; // torso lean forward (deg)
  knee: number; // interior knee angle (deg)
  shoulders: number; // shoulder width
  hips: number; // hip width
}
const TORSO = 0.5;
const THIGH = 0.45;
const SHIN = 0.45;

function pose3d(b: Body): Record<number, [number, number, number]> {
  // Hip at the origin; thigh forward-down at the half knee angle, shin back.
  const half = (180 - b.knee) / 2;
  const knee: [number, number] = [
    THIGH * Math.sin(half * RAD),
    THIGH * Math.cos(half * RAD),
  ];
  const ankle: [number, number] = [
    knee[0] - SHIN * Math.sin(half * RAD),
    knee[1] + SHIN * Math.cos(half * RAD),
  ];
  const sh: [number, number] = [
    TORSO * Math.sin(b.lean * RAD),
    -TORSO * Math.cos(b.lean * RAD),
  ];
  const p: Record<number, [number, number, number]> = {};
  const both = (l: number, r: number, x: number, y: number, w: number) => {
    p[l] = [x, y, -w / 2];
    p[r] = [x, y, w / 2];
  };
  both(11, 12, sh[0], sh[1], b.shoulders);
  both(23, 24, 0, 0, b.hips);
  // Legs straight under the hips (no sideways offset: a pure in-plane leg).
  both(25, 26, knee[0], knee[1], b.hips);
  both(27, 28, ankle[0], ankle[1], b.hips);
  both(7, 8, sh[0], sh[1] - 0.2, 0.14); // ears
  p[0] = [sh[0] + 0.1, sh[1] - 0.18, 0]; // nose, forward of the ears
  // Arms hanging (not used by these tests, but present).
  both(13, 14, sh[0], sh[1] + 0.3, b.shoulders);
  both(15, 16, sh[0] + 0.1, sh[1] + 0.55, b.shoulders);
  both(19, 20, sh[0] + 0.12, sh[1] + 0.62, b.shoulders);
  return p;
}

/** Frames of a still body seen `yaw` off side-on, near side = left. */
function frames(b: Body, yaw: number, n = 12): SignalFrame[] {
  const p = pose3d(b);
  const c = Math.cos(yaw * RAD);
  const s = Math.sin(yaw * RAD);
  return Array.from({ length: n }, (_, i) => ({
    frameIndex: i,
    timestamp: i / 30,
    landmarks: Array.from({ length: 33 }, (_, j) => {
      const q = p[j];
      if (!q) return { x: 0, y: 0, visibility: 0 };
      // Image on a square canvas (aspect 1), centred.
      return {
        x: 0.5 + (q[0] * c + q[2] * s) / 2,
        y: 0.5 + q[1] / 2,
        // The left side (−Z) faces the camera.
        visibility: j % 2 === 1 || j === 0 ? 0.99 : 0.6,
      };
    }),
  }));
}

const body: Body = { lean: 15, knee: 120, shoulders: 0.4, hips: 0.25 };
const frontal = { shoulders: 0.4 / TORSO, hips: 0.25 / TORSO }; // 0.8, 0.5

describe("camera angle from the body", () => {
  it("recovers the angle off side-on (exact proportions)", () => {
    for (const yaw of [0, 10, 20, 30, 40]) {
      const e = estimateCameraAngle(frames(body, yaw), { aspect: 1, frontal })!;
      // Within 1°: the leaning torso isn't exactly vertical, so its length
      // shrinks slightly with the angle too.
      expect(Math.abs(e.angle - yaw), `yaw ${yaw}`).toBeLessThan(1);
      expect(e.standingOpen).toBe(false);
    }
  });

  it("uses the population defaults when no proportions are given", () => {
    expect(DEFAULT_FRONTAL).toEqual({ shoulders: 0.8, hips: 0.5 });
    const e = estimateCameraAngle(frames(body, 25), { aspect: 1 })!;
    expect(e.angle).toBeCloseTo(25, 0);
  });

  it("flags shoulders and hips that disagree (standing open)", () => {
    // Shoulders turned 15° more than the hips.
    const f = frames(body, 20).map((fr, i) => {
      const open = frames(body, 35)[i]!;
      return {
        ...fr,
        landmarks: fr.landmarks!.map((l, j) =>
          j === 11 || j === 12 ? open.landmarks![j]! : l,
        ),
      };
    });
    const e = estimateCameraAngle(f, { aspect: 1, frontal })!;
    expect(e.standingOpen).toBe(true);
  });
});

describe("centre-line torso + angle correction", () => {
  const sig = (b: Body, yaw: number, cameraAngle?: number) =>
    computeSignals(frames(b, yaw), {
      aspect: 1,
      shootingHand: "left",
      nearSide: "left",
      ...(cameraAngle !== undefined ? { cameraAngle } : {}),
    });
  const mid = (xs: (number | null)[]) => xs[Math.floor(xs.length / 2)]!;

  it("torso lean doesn't depend on shoulder vs hip width off side-on", () => {
    const narrow = sig({ ...body, shoulders: 0.25 }, 40);
    const wide = sig({ ...body, shoulders: 0.45 }, 40);
    expect(narrow.centreLine).toBe(true);
    expect(mid(wide.spineLean)).toBeCloseTo(mid(narrow.spineLean), 6);
  });

  it("the 1/cos stretch restores in-plane angles at the true camera angle", () => {
    for (const yaw of [15, 30, 40]) {
      const raw = sig(body, yaw);
      const fixed = sig(body, yaw, yaw);
      expect(fixed.cameraAngle).toBe(yaw);
      expect(mid(fixed.spineLean)!, `lean @${yaw}`).toBeCloseTo(15, 1);
      // Uncorrected, the lean shrinks (foreshortened).
      expect(mid(raw.spineLean)!).toBeLessThan(15 - 0.4);
      expect(mid(fixed.kneeAngle)!, `knee @${yaw}`).toBeCloseTo(120, 0);
    }
  });

  it("no correction by default", () => {
    expect(sig(body, 0).cameraAngle).toBe(0);
    expect(mid(sig(body, 0).spineLean)!).toBeCloseTo(15, 1);
  });
});

describe("proportions", () => {
  it("segments from side-on frames, frontal widths from the widest frames", () => {
    const clips = [
      { frames: frames(body, 5), aspect: 1 },
      { frames: frames(body, 85, 4), aspect: 1 }, // turned to the camera
    ];
    const p = estimateProportions(clips);
    expect(p.frontalObserved).toBe(true);
    // ≈ 0.8 (the turned frames' torso is slightly foreshortened by the lean).
    expect(Math.abs(p.frontal.shoulders - 0.8)).toBeLessThan(0.04);
    expect(p.thigh!).toBeCloseTo(THIGH / TORSO, 1);
    expect(p.sideOnFrames).toBe(12);
  });

  it("falls back to the defaults when the player never turns", () => {
    const p = estimateProportions([{ frames: frames(body, 10), aspect: 1 }]);
    expect(p.frontalObserved).toBe(false);
    expect(p.frontal).toEqual(DEFAULT_FRONTAL);
  });
});

describe("labelled key frames replace detection", () => {
  const root = path.resolve(__dirname, "../../../test-data/stephen-curry-1");
  const poses = JSON.parse(
    fs.readFileSync(path.join(root, "poses.json"), "utf8"),
  );
  const labels = JSON.parse(
    fs.readFileSync(path.join(root, "labels.json"), "utf8"),
  );
  const shot = labels.shots[1];
  const win = poses.frames.slice(
    shot.startFrame - EVENT_PAD_BEFORE,
    shot.endFrame + EVENT_PAD_AFTER + 1,
  ) as SignalFrame[];
  const opts = {
    aspect: poses.width / poses.height,
    shootingHand: "right" as const,
  };

  it("maps label keys to events (clipped start labels left out)", () => {
    const ev = labeledEventFrames(shot);
    expect(ev.setPoint).toBe(shot.set_point);
    expect(ev.hipLowest).toBe(shot.leg_bend_low_point);
    const clipped = labeledEventFrames({
      ...shot,
      legs_start_bending: shot.startFrame,
    });
    expect(clipped.hipDropStart).toBeUndefined();
    // v2 labels keep key frames under `keyframes`.
    expect(
      labeledEventFrames({ startFrame: 0, keyframes: { set_point: 9 } })
        .setPoint,
    ).toBe(9);
  });

  it("measures at the labelled frames", () => {
    const m = computeShotMetricsV3(win, {
      ...opts,
      events: { setPoint: shot.set_point },
    });
    expect(m.events.setPoint).toBeCloseTo(shot.set_point, 6);
    expect(m.metrics["setPoint.elbow_angle"]!.frames).toEqual([shot.set_point]);
    const detected = computeShotMetricsV3(win, opts);
    // Other events are still detected.
    expect(m.events.ballLowest).toBeCloseTo(detected.events.ballLowest!, 6);
  });
});
