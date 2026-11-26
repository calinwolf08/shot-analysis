import { describe, expect, it } from "vitest";
import {
  checkGeometry,
  dotStacks,
  endAt,
  jointAt,
  nearestOnZone,
  placeCallout,
  poseIcons,
  type OverlayCheck,
  type OverlayLandmark,
  type Pt,
  type Zone,
} from "../keyframe-overlay";

const angle = (a: Pt, j: Pt, b: Pt) => {
  const u = { x: a.x - j.x, y: a.y - j.y };
  const v = { x: b.x - j.x, y: b.y - j.y };
  return Math.abs(
    (Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y) * 180) / Math.PI,
  );
};
const inside = (z: Zone, p: Pt) => {
  if (z.kind === "wedge") {
    const [a, b, c] = z.pts;
    const s = (p1: Pt, p2: Pt, p3: Pt) =>
      (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const d1 = s(p, a, b);
    const d2 = s(p, b, c);
    const d3 = s(p, c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }
  return (
    p.x >= z.x - 1e-9 &&
    p.x <= z.x + z.w + 1e-9 &&
    p.y >= z.y - 1e-9 &&
    p.y <= z.y + z.h + 1e-9
  );
};

/** A right-handed player facing screen-right, side-on (right side near). */
function pose(): OverlayLandmark[] {
  const lm: OverlayLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
  }));
  const set = (i: number, x: number, y: number) =>
    (lm[i] = { x, y, visibility: 0.9 });
  set(0, 0.56, 0.2); // nose
  set(8, 0.52, 0.2); // right ear
  set(11, 0.5, 0.3); // shoulders
  set(12, 0.5, 0.3);
  set(14, 0.58, 0.38); // right elbow
  set(16, 0.6, 0.28); // right wrist
  set(20, 0.63, 0.25); // right index
  set(23, 0.48, 0.55); // hips
  set(24, 0.48, 0.55);
  set(26, 0.56, 0.7); // right knee
  set(25, 0.56, 0.7);
  set(28, 0.5, 0.85); // right ankle
  set(27, 0.5, 0.85);
  set(32, 0.55, 0.87); // right foot index
  return lm;
}
const shot = {
  facing: 1 as const,
  nearSide: "right" as const,
  shootingSide: "right" as const,
  xScale: 1,
  lengths: { torso: 0.25, thigh: 0.17 },
  centreLine: true,
};
const check = (id: string, passMin: number, passMax: number): OverlayCheck => {
  const [keyframe, c] = id.split(".") as [
    OverlayCheck["keyframe"],
    OverlayCheck["check"],
  ];
  return { id, keyframe, check: c, passMin, passMax, score: 0 };
};

describe("target positions for angle checks", () => {
  it("jointAt puts the joint at the asked angle, both ends held", () => {
    const A = { x: 0, y: 1 };
    const B = { x: 0.1, y: 0 };
    const J = { x: 0.3, y: 0.5 };
    for (const d of [100, 140, 170]) {
      const j = jointAt(A, B, J, d);
      // B slides along the A→B line; recover it from the limb length.
      const lb = Math.hypot(B.x - J.x, B.y - J.y);
      const la = Math.hypot(J.x - A.x, J.y - A.y);
      expect(Math.hypot(j.x - A.x, j.y - A.y)).toBeCloseTo(la, 9);
      const u = {
        x: (B.x - A.x) / Math.hypot(B.x - A.x, B.y - A.y),
        y: (B.y - A.y) / Math.hypot(B.x - A.x, B.y - A.y),
      };
      const D = Math.sqrt(
        la * la + lb * lb - 2 * la * lb * Math.cos((d * Math.PI) / 180),
      );
      const b2 = { x: A.x + u.x * D, y: A.y + u.y * D };
      expect(angle(A, j, b2)).toBeCloseTo(d, 6);
      // Stays on the same side of the line as the real joint.
      expect(j.x).toBeGreaterThan(0);
    }
  });

  it("endAt swings the limb end to the asked angle", () => {
    const J = { x: 0, y: 0 };
    const R = { x: 0, y: 1 };
    const E = { x: 0.5, y: -0.5 };
    expect(angle(R, J, endAt(J, R, E, 120))).toBeCloseTo(120, 6);
  });
});

describe("checkGeometry", () => {
  const lm = pose();
  const raw = {
    knee: angle(lm[24]!, lm[26]!, lm[28]!),
    elbow: angle(lm[12]!, lm[14]!, lm[16]!),
    hinge: angle(lm[14]!, lm[16]!, lm[20]!),
  };

  it("a joint whose value is in the band sits in its box; out of band, outside", () => {
    for (const [id, v, joint] of [
      ["rise.knee_bend", raw.knee, 26],
      ["rise.elbow_bend", raw.elbow, 14],
    ] as const) {
      const ok = checkGeometry(lm, shot, [check(id, v - 5, v + 5)])[id]!;
      expect(ok.dot).toEqual({ x: lm[joint]!.x, y: lm[joint]!.y });
      expect(inside(ok.zone!, ok.dot!), id).toBe(true);
      const off = checkGeometry(lm, shot, [check(id, v + 30, v + 45)])[id]!;
      expect(inside(off.zone!, off.dot!), id).toBe(false);
    }
  });

  it("wrist hinge: dot on the wrist, box where the fingertip should point", () => {
    const g = checkGeometry(lm, shot, [
      check("rise.wrist_hinge", raw.hinge - 5, raw.hinge + 5),
    ])["rise.wrist_hinge"]!;
    expect(g.joint).toBe("wrist");
    expect(inside(g.zone!, lm[20]!)).toBe(true);
    expect(g.limbs).toHaveLength(3);
  });

  it("hand height and ball close each get their own box at the wrist", () => {
    const hc = { x: 0.48, y: 0.55 };
    const height = (hc.y - lm[16]!.y) / 0.25;
    const close = (lm[16]!.x - hc.x) / 0.25;
    const gs = checkGeometry(lm, shot, [
      check("load.hand_height", height - 0.1, height + 0.1),
      check("load.ball_close", close + 0.3, close + 0.5), // ball too close
    ]);
    // Hand height in range: its box holds the wrist, whatever ball close says.
    expect(inside(gs["load.hand_height"]!.zone!, lm[16]!)).toBe(true);
    // Ball close out of range: its box is further forward, level with the wrist.
    const bc = gs["load.ball_close"]!.zone!;
    expect(inside(bc, lm[16]!)).toBe(false);
    if (bc.kind === "box") {
      expect(bc.x).toBeGreaterThan(lm[16]!.x);
      expect(bc.y).toBeLessThan(lm[16]!.y);
      expect(bc.y + bc.h).toBeGreaterThan(lm[16]!.y);
    }
    const low = checkGeometry(lm, shot, [
      check("load.hand_height", height + 0.3, height + 0.5),
    ]);
    expect(inside(low["load.hand_height"]!.zone!, lm[16]!)).toBe(false);
  });

  it("a tiny band is padded away from an out-of-range joint, never over it", () => {
    // Knee just outside a 1° band: the padded box must not swallow it.
    const g = checkGeometry(lm, shot, [
      check("rise.knee_bend", raw.knee + 1.5, raw.knee + 2.5),
    ])["rise.knee_bend"]!;
    expect(inside(g.zone!, g.dot!)).toBe(false);
  });

  it("draws the stored measured joints when the shot has them", () => {
    const pts = {
      wrist: { x: 0.7, y: 0.3 },
      elbow: { x: 0.6, y: 0.4 },
      shoulder: { x: 0.5, y: 0.3 },
      index: { x: 0.72, y: 0.27 },
      hip: { x: 0.48, y: 0.55 },
      knee: { x: 0.56, y: 0.7 },
      ankle: { x: 0.5, y: 0.85 },
      head: { x: 0.52, y: 0.2 },
      hipCentre: { x: 0.48, y: 0.55 },
      shoulderCentre: { x: 0.5, y: 0.3 },
    };
    const g = checkGeometry(
      lm,
      {
        ...shot,
        points: {
          setup: null,
          load: null,
          rise: pts,
          setPoint: null,
          release: null,
        },
      },
      [check("rise.hand_height", 0, 0.1)],
    )["rise.hand_height"]!;
    expect(g.dot).toEqual({ x: 0.7, y: 0.3 });
  });

  it("back: a wedge from the hip centre; hips: a band down to the ground", () => {
    const lean = (Math.atan2(0.5 - 0.48, 0.55 - 0.3) * 180) / Math.PI;
    const g = checkGeometry(lm, shot, [
      check("rise.back", lean - 3, lean + 3),
      check("rise.hips_over_knees", -0.6, -0.4),
    ]);
    expect(inside(g["rise.back"]!.zone!, g["rise.back"]!.dot!)).toBe(true);
    const band = g["rise.hips_over_knees"]!.zone!;
    expect(band.kind).toBe("band");
    if (band.kind === "band") {
      expect(band.y).toBeLessThan(lm[24]!.y);
      expect(band.y + band.h).toBeCloseTo(0.87, 6); // the lowest foot point
      // hip − knee = −0.08 = −0.47 thighs: inside −0.6..−0.4.
      expect(inside(band, { x: lm[24]!.x, y: lm[24]!.y })).toBe(true);
    }
  });

  it("the hold has no dot or zone", () => {
    const g = checkGeometry(lm, shot, [check("setPoint.hold", 0, 0.07)])[
      "setPoint.hold"
    ]!;
    expect(g.dot).toBeNull();
    expect(g.zone).toBeNull();
  });

  it("mirrors for a player facing screen-left", () => {
    const m = lm.map((l) => ({ ...l, x: 1 - l.x }));
    const g = checkGeometry(m, { ...shot, facing: -1 }, [
      check("rise.hips_over_knees", -0.6, -0.4),
    ]);
    const band = g["rise.hips_over_knees"]!.zone!;
    expect(inside(band, { x: m[24]!.x, y: m[24]!.y })).toBe(true);
  });
});

describe("dot stacks, arrows and the callout", () => {
  it("stacks dots on the same joint, worst first, side by side", () => {
    const s = dotStacks([
      { id: "a", at: { x: 100, y: 100 }, score: 0 },
      { id: "b", at: { x: 104, y: 102 }, score: 3 },
      { id: "c", at: { x: 200, y: 100 }, score: 1 },
    ]);
    expect(s).toHaveLength(2);
    expect(s[0]!.ids).toEqual(["b", "a"]);
    expect(s[0]!.pos[0]!.x).toBeLessThan(s[0]!.pos[1]!.x);
    expect(s[1]!.ids).toEqual(["c"]);
  });

  it("arrows to the zone's nearest edge, none from inside", () => {
    const rect = { kind: "rect" as const, x: 10, y: 10, w: 20, h: 20 };
    expect(nearestOnZone(rect, { x: 15, y: 15 })).toBeNull();
    expect(nearestOnZone(rect, { x: 50, y: 15 })).toEqual({ x: 30, y: 15 });
    const tri = {
      kind: "poly" as const,
      pts: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ],
    };
    expect(nearestOnZone(tri, { x: 1, y: 1 })).toBeNull();
    expect(nearestOnZone(tri, { x: -5, y: 5 })).toEqual({ x: 0, y: 5 });
  });

  it("puts the callout in free space, near its dot", () => {
    // Obstacles fill the left half; the dot is in the middle.
    const obstacles = [];
    for (let x = 0; x < 200; x += 10)
      for (let y = 0; y < 400; y += 10)
        obstacles.push({ x, y, weight: 5, radius: 6 });
    const p = placeCallout({ w: 120, h: 40 }, { x: 200, y: 200 }, obstacles, {
      x0: 0,
      y0: 0,
      x1: 400,
      y1: 400,
    });
    expect(p.x).toBeGreaterThanOrEqual(200);
    expect(Math.abs(p.y + 20 - 200)).toBeLessThan(80);
  });

  it("draws one stick figure per keyframe on a shared scale", () => {
    const icons = poseIcons([pose(), null, pose()], 1, "right");
    expect(icons[1]).toBeNull();
    expect(icons[0]!.lines.length).toBeGreaterThanOrEqual(5);
    for (const [a, b] of icons[0]!.lines) {
      for (const p of [a, b]) {
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(44);
      }
    }
  });
});
