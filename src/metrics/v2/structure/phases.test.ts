import { describe, it, expect } from "vitest";
import type { KeyframeId } from "../../../testing/types";
import { derivePhaseRanges } from "./phases";

function kf(entries: Partial<Record<KeyframeId, number | null>>) {
  return new Map<KeyframeId, number | null>(
    Object.entries(entries) as [KeyframeId, number | null][],
  );
}

describe("derivePhaseRanges", () => {
  it("derives every phase when all keyframes are present", () => {
    const p = derivePhaseRanges(
      kf({
        legs_start_bending: 1,
        leg_bend_low_point: 4,
        ball_low_point: 3,
        set_point: 7,
        legs_fully_extended: 8,
        arms_fully_extended: 10,
        release: 9,
      }),
      0,
      10,
    );
    expect(p.gather).toBe(0);
    expect(p.load).toEqual({ start: 1, end: 4 });
    expect(p.rise).toEqual({ start: 4, end: 7 });
    expect(p.setPoint).toBe(7);
    expect(p.release).toEqual({ start: 7, end: 10 }); // set_point → arms_fully_extended
    expect(p.followThrough).toEqual({ start: 9, end: 10 }); // release → end
  });

  it("falls back to the ball low point when the leg low point is missing", () => {
    const p = derivePhaseRanges(
      kf({
        legs_start_bending: 1,
        ball_low_point: 3,
        set_point: 7,
      }),
      0,
      10,
    );
    // load end and rise start both fall back to ball_low_point (3)
    expect(p.load).toEqual({ start: 1, end: 3 });
    expect(p.rise).toEqual({ start: 3, end: 7 });
  });

  it("falls back to the start frame when legs_start_bending is missing", () => {
    const p = derivePhaseRanges(
      kf({ leg_bend_low_point: 4, set_point: 7 }),
      2,
      10,
    );
    expect(p.load).toEqual({ start: 2, end: 4 });
  });

  it("returns null phases whose bounds cannot be established", () => {
    // No low point at all → both load and rise lose their shared bound.
    const p = derivePhaseRanges(
      kf({ legs_start_bending: 1, set_point: 7 }),
      0,
      10,
    );
    expect(p.load).toBeNull(); // range(1, null)
    expect(p.rise).toBeNull(); // range(null, 7)
  });

  it("returns null when the range would be inverted (end before start)", () => {
    // set_point before the deepest bend → rise inverted → null
    const p = derivePhaseRanges(
      kf({
        legs_start_bending: 1,
        leg_bend_low_point: 6,
        set_point: 4,
      }),
      0,
      10,
    );
    expect(p.rise).toBeNull();
  });

  it("falls back through release → arms_fully_extended → end for the release phase", () => {
    const noExtension = derivePhaseRanges(
      kf({ set_point: 7, release: 9 }),
      0,
      10,
    );
    // release phase end falls back to the release snap (9) when arms_fully_extended missing
    expect(noExtension.release).toEqual({ start: 7, end: 9 });

    const noReleaseNoExt = derivePhaseRanges(kf({ set_point: 7 }), 0, 10);
    // falls back to end frame
    expect(noReleaseNoExt.release).toEqual({ start: 7, end: 10 });
  });

  it("bounds follow-through with arms_fully_extended when release is missing", () => {
    const p = derivePhaseRanges(
      kf({ set_point: 7, arms_fully_extended: 8 }),
      0,
      10,
    );
    expect(p.followThrough).toEqual({ start: 8, end: 10 });
  });

  it("returns null follow-through when neither release nor extension exists", () => {
    const p = derivePhaseRanges(kf({ set_point: 7 }), 0, 10);
    expect(p.followThrough).toBeNull();
  });
});
