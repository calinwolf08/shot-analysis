import { describe, expect, it } from "vitest";
import { DEFAULT_WORDING } from "basketball-shot-analysis";
import {
  GEOMETRY_IDS,
  drawGeometry,
  geometryFamily,
  geometryFor,
  jointIndex,
  resolveJoint,
  screenAngle,
  type Landmark,
} from "../metric-geometry";

/** Records the calls a draw makes (enough to see what was drawn). */
function fakeCtx() {
  const calls: string[] = [];
  const rec =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(
        `${name}(${args.map((a) => (typeof a === "number" ? a.toFixed(0) : String(a))).join(",")})`,
      );
    };
  const ctx = new Proxy({ calls } as Record<string, unknown>, {
    get(t, k: string) {
      if (k in t) return t[k];
      return rec(k);
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

/** A standing side-on skeleton with a 90° knee and elbow. */
function pose(): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
  }));
  const set = (i: number, x: number, y: number) =>
    (lm[i] = { x, y, visibility: 1 });
  set(8, 0.5, 0.2); // right ear
  set(12, 0.5, 0.3); // right shoulder
  set(14, 0.6, 0.3); // right elbow (upper arm horizontal)
  set(16, 0.6, 0.2); // right wrist (forearm vertical) → 90°
  set(20, 0.62, 0.18);
  set(24, 0.5, 0.55); // right hip
  set(26, 0.6, 0.55); // right knee (thigh horizontal)
  set(28, 0.6, 0.8); // right ankle (shin vertical) → 90°
  return lm;
}
const sides = { shootingHand: "right", nearSide: "right" } as const;
const project = (l: { x: number; y: number }) => ({
  x: l.x * 400,
  y: l.y * 400,
});

describe("metric geometry", () => {
  it("covers every v3 metric that has wording", () => {
    const missing = Object.keys(DEFAULT_WORDING).filter(
      (id) => geometryFor(id).length === 0,
    );
    expect(missing).toEqual([]);
    expect(new Set(GEOMETRY_IDS)).toEqual(
      new Set(Object.keys(DEFAULT_WORDING)),
    );
  });

  it("maps families: angle, lean, offset, height, path, timing", () => {
    expect(geometryFamily("load.knee_depth")).toBe("angle");
    expect(geometryFamily("setPoint.spine_angle")).toBe("lean");
    expect(geometryFamily("load.hip_over_knee")).toBe("offset");
    expect(geometryFamily("setPoint.wrist_vs_head")).toBe("height");
    expect(geometryFamily("release.elbow_path")).toBe("path");
    expect(geometryFamily("rise.t_start")).toBe("timing");
    expect(geometryFamily("nope")).toBeNull();
  });

  it("reads arm joints on the shooting side, legs on the near side", () => {
    const s = { shootingHand: "right", nearSide: "left" } as const;
    expect(jointIndex("elbow", s)).toBe(14);
    expect(jointIndex("knee", s)).toBe(25);
    expect(jointIndex("shoulderNear", s)).toBe(11);
    expect(jointIndex("guideWrist", s)).toBe(15);
    expect(jointIndex("head", s)).toBe(7);
  });

  it("falls back from a hidden ear to the nose for the head", () => {
    const lm = pose();
    lm[8] = { x: 0.5, y: 0.2, visibility: 0.1 };
    lm[0] = { x: 0.55, y: 0.21, visibility: 0.9 };
    expect(resolveJoint(lm, "head", sides)).toEqual(lm[0]);
  });

  it("screenAngle is the interior angle", () => {
    expect(
      screenAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }),
    ).toBeCloseTo(90);
    expect(
      screenAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 0 }),
    ).toBeCloseTo(180);
  });

  it("draws the knee angle with its value label", () => {
    const { ctx, calls } = fakeCtx();
    const drawn = drawGeometry(ctx, geometryFor("load.knee_depth"), pose(), {
      ...sides,
      project,
    });
    expect(drawn).toEqual(["angle"]);
    expect(calls.some((c) => c.startsWith("arc("))).toBe(true);
    expect(calls.some((c) => c.startsWith("fillText(90°"))).toBe(true);
  });

  it("draws nothing for a joint that isn't visible on this frame", () => {
    const lm = pose();
    lm[26] = { x: 0.6, y: 0.55, visibility: 0 };
    const { ctx } = fakeCtx();
    expect(
      drawGeometry(ctx, geometryFor("load.knee_depth"), lm, {
        ...sides,
        project,
      }),
    ).toEqual([]);
  });

  it("draws a path over the metric's frames", () => {
    const { ctx, calls } = fakeCtx();
    const frames = [0.3, 0.25, 0.2].map((y) => {
      const lm = pose();
      lm[14] = { x: 0.6, y, visibility: 1 };
      return lm;
    });
    const drawn = drawGeometry(
      ctx,
      geometryFor("release.elbow_path"),
      frames[1],
      {
        ...sides,
        project,
        pathFrames: frames,
      },
    );
    expect(drawn).toEqual(["path"]);
    expect(calls.filter((c) => c.startsWith("lineTo(")).length).toBe(2);
  });
});
