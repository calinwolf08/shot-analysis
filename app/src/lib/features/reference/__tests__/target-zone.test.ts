import { describe, expect, it } from "vitest";
import { targetZone, zoneStyleFor } from "../target-zone";

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

  it("wedge: at the knee, the target angle centred on the measured one", () => {
    const z = targetZone(knee, { ...sides, project, lm, style: "wedge" });
    expect(z?.kind).toBe("wedge");
    if (z?.kind !== "wedge") return;
    expect(z.center).toEqual({ x: 100, y: 0 });
    // Measured 90° between the thigh (180°) and shin (90°): bisector 135°.
    // Target 170–180° = 85–90° either side of it.
    const deg = (r: number) =>
      ((Math.round((r * 180) / Math.PI) % 360) + 360) % 360;
    const sectors = z.sectors.map((x) =>
      [deg(x.from), deg(x.to)].sort((p, q) => p - q),
    );
    expect(sectors).toEqual([
      [220, 225],
      [45, 50],
    ]);
    expect(z.radius).toBeLessThanOrEqual(72);
  });

  it("rect: a box where the KNEE belongs (feet planted)", () => {
    const z = targetZone(knee, { ...sides, project, lm, style: "rect" });
    expect(z?.kind).toBe("rect");
    if (z?.kind !== "rect") return;
    // Straight leg (180°): the knee on the ankle→hip line, a shin from the
    // ankle (≈ 29, 29); at 170° slightly toward where it bends now.
    expect(z.x).toBeLessThan(29);
    expect(z.x + z.w).toBeGreaterThan(29);
    expect(z.y).toBeLessThan(29);
    expect(z.y + z.h).toBeGreaterThan(29);
  });

  it("rect: a small change in bend keeps the box at the knee", () => {
    const z = targetZone(
      { ...knee, passMin: 95, passMax: 100 },
      { ...sides, project, lm, style: "rect" },
    );
    if (z?.kind !== "rect") throw new Error("no rect");
    const cx = z.x + z.w / 2;
    const cy = z.y + z.h / 2;
    expect(Math.hypot(cx - 100, cy - 0)).toBeLessThan(25);
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

  it("picks the visualization per metric", () => {
    for (const id of [
      "load.knee_depth",
      "setPoint.knee_angle",
      "release.knee_change",
      "load.hip_over_knee",
      "setPoint.wrist_vs_head",
      "release.guide_hand_dx",
    ])
      expect([id, zoneStyleFor(id)]).toEqual([id, "rect"]);
    for (const id of [
      "load.spine_angle",
      "rise.spine_change",
      "load.head_pitch",
      "setPoint.elbow_angle",
      "load.elbow_change",
      "setPoint.hip_angle",
      "release.wrist_snap",
    ])
      expect([id, zoneStyleFor(id)]).toEqual([id, "wedge"]);
    // Without an override, targetZone follows it.
    const z = targetZone(knee, { ...sides, project, lm });
    expect(z?.kind).toBe("rect");
  });
});
