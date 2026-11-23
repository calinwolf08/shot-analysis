import { describe, expect, it } from "vitest";
import type { SignalFrame } from "../metrics/v3";
import {
  frontCalibration,
  frontalFor,
  parseCalibration,
  sideCalibration,
} from "./calibration";

const RAD = Math.PI / 180;
/**
 * A standing body (torso 0.3 tall) seen `yaw` off side-on, true widths
 * shoulders 0.24 / hips 0.15 (0.8 / 0.5 × torso), thigh/shin 0.27 (0.9 ×),
 * upper arm 0.18 / forearm 0.15 (0.6 / 0.5 ×), hanging straight down.
 */
function standing(yaw: number, n = 3): SignalFrame[] {
  const s = Math.sin(yaw * RAD);
  const pts: Record<number, [number, number, number]> = {};
  const both = (l: number, r: number, y: number, w: number) => {
    pts[l] = [0, y, -w / 2];
    pts[r] = [0, y, w / 2];
  };
  both(11, 12, 0.2, 0.24); // shoulders
  both(13, 14, 0.38, 0.28); // elbows (arms slightly out)
  both(15, 16, 0.53, 0.3); // wrists
  both(23, 24, 0.5, 0.15); // hips
  both(25, 26, 0.77, 0.15); // knees
  both(27, 28, 1.04, 0.15); // ankles
  return Array.from({ length: n }, (_, i) => ({
    frameIndex: i,
    timestamp: i,
    landmarks: Array.from({ length: 33 }, (_, j) => {
      const p = pts[j];
      return p
        ? { x: 0.5 + p[2] * s * 0.9, y: p[1] * 0.9, visibility: 0.95 }
        : { x: 0, y: 0, visibility: 0 };
    }),
  }));
}

describe("front-on calibration", () => {
  it("measures the true shoulder / hip widths", () => {
    const r = frontCalibration(standing(90), 1);
    expect(r.values!.shoulders).toBeCloseTo(0.8, 2);
    expect(r.values!.hips).toBeCloseTo(0.5, 2);
    expect(r.frames).toBe(3);
    expect(r.warnings).toEqual([]);
  });

  it("warns when the photo isn't front-on", () => {
    const r = frontCalibration(standing(30), 1);
    expect(r.warnings.join(" ")).toMatch(/not be front-on/);
  });

  it("nothing usable without both shoulders and hips", () => {
    expect(
      frontCalibration([{ frameIndex: 0, timestamp: 0, landmarks: null }], 1)
        .values,
    ).toBeNull();
  });
});

describe("side-on calibration", () => {
  it("measures limb lengths ÷ torso", () => {
    const r = sideCalibration(standing(0), 1);
    expect(r.values!.thigh).toBeCloseTo(0.9, 2);
    expect(r.values!.shin).toBeCloseTo(0.9, 2);
    expect(r.values!.upperArm).toBeCloseTo(0.6, 2);
    expect(r.values!.forearm).toBeCloseTo(0.5, 2);
    expect(r.warnings).toEqual([]);
  });

  it("warns when the photo isn't side-on", () => {
    expect(sideCalibration(standing(60), 1).warnings.join(" ")).toMatch(
      /not be side-on/,
    );
  });
});

describe("using calibration", () => {
  it("front-on photo first, then widths seen in clips, then nothing (defaults)", () => {
    const cal = parseCalibration({
      front: { shoulders: 0.7, hips: 0.45, frames: 1, at: "x" },
    });
    const clips = {
      frontalObserved: true,
      frontal: { shoulders: 0.85, hips: 0.52 },
    };
    expect(frontalFor(cal, clips)).toEqual({ shoulders: 0.7, hips: 0.45 });
    expect(frontalFor(undefined, clips)).toEqual({
      shoulders: 0.85,
      hips: 0.52,
    });
    expect(
      frontalFor(undefined, { ...clips, frontalObserved: false }),
    ).toBeUndefined();
  });

  it("parses player.json, dropping anything malformed", () => {
    expect(parseCalibration(null)).toBeUndefined();
    expect(parseCalibration({ front: { shoulders: "x" } })).toBeUndefined();
    expect(parseCalibration({ side: { thigh: 0.9, shin: null } })).toEqual({
      side: {
        thigh: 0.9,
        shin: null,
        upperArm: null,
        forearm: null,
        frames: 0,
        at: "",
      },
    });
  });
});
