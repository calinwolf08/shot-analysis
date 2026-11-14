import { describe, it, expect } from "vitest";
import type { KeyframeId } from "../../testing/types";
import { computeSequencing } from "./sequencing";

function kf(entries: Partial<Record<KeyframeId, number | null>>) {
  return new Map<KeyframeId, number | null>(
    Object.entries(entries) as [KeyframeId, number | null][],
  );
}

// A well-ordered shot spanning frames 0..20.
const ORDERED = kf({
  ball_low_point: 2,
  ball_starts_upward: 4,
  leg_bend_low_point: 6,
  legs_start_extending: 8,
  set_point: 12,
  legs_fully_extended: 15,
  release: 16,
  arms_fully_extended: 18,
});

describe("computeSequencing", () => {
  it("locates every event with a normalized time in [0,1]", () => {
    const s = computeSequencing(ORDERED, 0, 20);
    expect(s.events).toHaveLength(8);
    for (const e of s.events) {
      expect(e.frame).not.toBeNull();
      expect(e.t).not.toBeNull();
      expect(e.t!).toBeGreaterThanOrEqual(0);
      expect(e.t!).toBeLessThanOrEqual(1);
    }
    // ball_low at frame 2 of 20 → 0.1
    expect(s.events[0]!.t).toBeCloseTo(0.1, 5);
    expect(s.coverage).toBe(1);
  });

  it("produces a signed gap per consecutive pair", () => {
    const s = computeSequencing(ORDERED, 0, 20);
    expect(s.gaps).toHaveLength(7);
    // ball_low(0.1) → ball_rise(0.2) gap = +0.1
    const first = s.gaps[0]!;
    expect(first.from).toBe("ball_low");
    expect(first.to).toBe("ball_rise");
    expect(first.gap.reliable).toBe(true);
    expect(first.gap.value).toBeCloseTo(0.1, 5);
    // All correctly-ordered → all gaps positive.
    for (const g of s.gaps) {
      if (g.gap.reliable) expect(g.gap.value).toBeGreaterThan(0);
    }
  });

  it("gives a negative gap when two events are out of order", () => {
    // ball starts rising (3) BEFORE ball low point (5) — order violation.
    const s = computeSequencing(
      kf({ ball_low_point: 5, ball_starts_upward: 3 }),
      0,
      20,
    );
    const g = s.gaps.find((x) => x.from === "ball_low" && x.to === "ball_rise")!;
    expect(g.gap.reliable).toBe(true);
    expect(g.gap.value).toBeLessThan(0); // (3-5)/20 = -0.1
    expect(g.gap.value).toBeCloseTo(-0.1, 5);
  });

  it("marks gaps unavailable and lowers coverage when a keyframe is missing", () => {
    const s = computeSequencing(
      kf({
        ball_low_point: 2,
        ball_starts_upward: 4,
        // leg_bend_low_point missing
        legs_start_extending: 8,
      }),
      0,
      20,
    );
    expect(s.coverage).toBeCloseTo(3 / 8, 5);
    const g = s.gaps.find((x) => x.to === "leg_low")!;
    expect(g.gap.reliable).toBe(false);
    expect(g.gap.note).toMatch(/not detected/i);
  });
});
