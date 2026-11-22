import { describe, expect, it } from "vitest";
import { targetZone } from "../target-zone";

/** A right-shooter, right-near-side pose with given joints (others hidden). */
function pose(j: Record<number, [number, number]>) {
  return Array.from({ length: 33 }, (_, i) =>
    j[i]
      ? { x: j[i]![0], y: j[i]![1], visibility: 1 }
      : { x: 0, y: 0, visibility: 0 },
  );
}
const sides = { shootingHand: "right", nearSide: "right" } as const;
const project = (l: { x: number; y: number }) => ({ x: l.x, y: l.y });

describe("targetZone", () => {
  // Shin straight down from the knee; thigh horizontal (90° knee).
  const lm = pose({
    24: [0, 0],
    26: [100, 0],
    28: [100, 100],
    0: [10, -50],
    8: [0, -50],
  });
  const knee = {
    id: "load.knee_depth",
    passMin: 170,
    passMax: 180,
    frames: [5],
  };

  it("wedge: the band of hip directions around the knee", () => {
    const z = targetZone(knee, { ...sides, project, lm, style: "wedge" });
    expect(z?.kind).toBe("wedge");
    if (z?.kind !== "wedge") return;
    expect(z.center).toEqual({ x: 100, y: 0 });
    expect(z.radius).toBeCloseTo(100);
    // 170–180° from the shin (pointing down), on the thigh's side (left) =
    // up, tilted toward the hip: screen angles 260–270° (≡ −100…−90°).
    const ends = [z.from, z.to].map((a) => Math.round((a * 180) / Math.PI));
    expect(ends.sort((a, b) => a - b)).toEqual([260, 270]);
  });

  it("rect: a box around where the hips belong", () => {
    const z = targetZone(knee, { ...sides, project, lm, style: "rect" });
    expect(z?.kind).toBe("rect");
    if (z?.kind !== "rect") return;
    // Hip target ≈ (83..100, -100..-98): the box surrounds it.
    expect(z.x).toBeLessThan(83);
    expect(z.x + z.w).toBeGreaterThan(100);
    expect(z.y).toBeLessThan(-100);
    expect(z.y + z.h).toBeGreaterThan(-98);
  });

  it("offset: the band of x where the hip belongs, in thigh lengths", () => {
    const z = targetZone(
      {
        id: "setPoint.hip_over_knee",
        passMin: -0.1,
        passMax: 0.1,
        frames: [5],
      },
      { ...sides, project, lm, style: "wedge", facing: 1 },
    );
    expect(z?.kind).toBe("rect");
    if (z?.kind !== "rect") return;
    expect(z.x).toBeCloseTo(90);
    expect(z.w).toBeCloseTo(20);
  });

  it("no zone for timing or a missing joint", () => {
    expect(
      targetZone(
        { id: "rise.t_start", passMin: 0, passMax: 1, frames: [1, 2] },
        { ...sides, project, lm, style: "rect" },
      ),
    ).toBeNull();
    expect(
      targetZone(knee, { ...sides, project, lm: pose({}), style: "rect" }),
    ).toBeNull();
  });
});
