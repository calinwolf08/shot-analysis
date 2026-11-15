import { describe, expect, it } from "vitest";
import { phasesFromKeyframes, poseLandmarksToFrames } from "./keyframe-phases";
import { ShotPhase } from "./types";
import type { KeyframeId } from "../testing/types";
import type { PoseLandmarks } from "../pose/types";

function kfMap(
  entries: Partial<Record<KeyframeId, number | null>>,
): Map<KeyframeId, number | null> {
  return new Map(Object.entries(entries) as [KeyframeId, number | null][]);
}

describe("phasesFromKeyframes", () => {
  it("maps a full keyframe set to ordered, non-overlapping phases", () => {
    const kf = kfMap({
      legs_start_bending: 12,
      leg_bend_low_point: 18,
      ball_low_point: 17,
      ball_starts_upward: 19,
      set_point: 26,
      release: 28,
      arms_fully_extended: 30,
      feet_leave_ground: 29,
      feet_land: 36,
    });
    const p = phasesFromKeyframes(kf, 10, 40);

    expect(p[ShotPhase.Gather]).toEqual({ startFrame: 10, endFrame: 11 });
    expect(p[ShotPhase.Load]).toEqual({ startFrame: 12, endFrame: 18 });
    expect(p[ShotPhase.Rise]).toEqual({ startFrame: 19, endFrame: 25 });
    expect(p[ShotPhase.SetPoint]).toEqual({ startFrame: 26, endFrame: 26 });
    expect(p[ShotPhase.Release]).toEqual({ startFrame: 27, endFrame: 30 });
    expect(p[ShotPhase.FollowThrough]).toEqual({ startFrame: 31, endFrame: 40 });

    // Phases are ordered and contiguous (no overlap).
    const order = [
      ShotPhase.Gather,
      ShotPhase.Load,
      ShotPhase.Rise,
      ShotPhase.SetPoint,
      ShotPhase.Release,
      ShotPhase.FollowThrough,
    ];
    for (let i = 1; i < order.length; i++) {
      const prev = p[order[i - 1]!]!;
      const cur = p[order[i]!]!;
      expect(cur.startFrame).toBeGreaterThan(prev.endFrame);
    }
  });

  it("skips Gather when legs_start_bending is the shot start", () => {
    const kf = kfMap({
      legs_start_bending: 10,
      ball_low_point: 15,
      ball_starts_upward: 16,
      set_point: 22,
      arms_fully_extended: 26,
    });
    const p = phasesFromKeyframes(kf, 10, 40);
    expect(p[ShotPhase.Gather]).toBeUndefined();
    expect(p[ShotPhase.Load]).toEqual({ startFrame: 10, endFrame: 15 });
  });

  it("returns only derivable phases when keyframes are missing", () => {
    // Elbow occluded → no set_point/release/arms.
    const kf = kfMap({
      legs_start_bending: 12,
      leg_bend_low_point: 18,
      ball_starts_upward: 19,
      set_point: null,
      release: null,
      arms_fully_extended: null,
    });
    const p = phasesFromKeyframes(kf, 10, 40);
    expect(p[ShotPhase.Load]).toEqual({ startFrame: 12, endFrame: 18 });
    expect(p[ShotPhase.SetPoint]).toBeUndefined();
    expect(p[ShotPhase.Release]).toBeUndefined();
    expect(p[ShotPhase.FollowThrough]).toBeUndefined();
    // Rise has no set_point end → skipped rather than a bad range.
    expect(p[ShotPhase.Rise]).toBeUndefined();
  });

  it("clamps ranges to the shot bounds", () => {
    const kf = kfMap({
      legs_start_bending: 12,
      ball_low_point: 18,
      ball_starts_upward: 19,
      set_point: 26,
      arms_fully_extended: 999, // past the shot end → clamps to end
    });
    const p = phasesFromKeyframes(kf, 10, 40);
    // Release runs from set_point+1 to the clamped arms_fully_extended (40).
    expect(p[ShotPhase.Release]).toEqual({ startFrame: 27, endFrame: 40 });
    // FollowThrough would start at 41 (> end) → degenerate → skipped.
    expect(p[ShotPhase.FollowThrough]).toBeUndefined();
  });
});

describe("poseLandmarksToFrames", () => {
  it("adapts pose landmarks to frames with sequential indexes", () => {
    const seq: PoseLandmarks[] = [
      {
        landmarks: [{ x: 0.1, y: 0.2, z: 0.3, visibility: 0.9, confidence: 0.8 }],
        poseConfidence: 0.9,
      },
      {
        landmarks: [{ x: 0.4, y: 0.5, z: 0.6, visibility: 0.7, confidence: 0.6 }],
        poseConfidence: 0.8,
      },
    ];
    const frames = poseLandmarksToFrames(seq);
    expect(frames.map((f) => f.frameIndex)).toEqual([0, 1]);
    expect(frames[0]!.landmarks![0]).toEqual({
      x: 0.1,
      y: 0.2,
      z: 0.3,
      visibility: 0.9,
    });
  });
});
