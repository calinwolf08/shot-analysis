import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeShotFraming,
  estimateAspect,
  projectWith,
  shotBounds,
  sourceRect,
  type FramingFrame,
} from "../framing";

const FIXTURES = join(process.cwd(), "src-tests", "fixtures", "poses");
function fixture(id: string) {
  return JSON.parse(readFileSync(join(FIXTURES, `${id}.json`), "utf8")) as {
    width: number;
    height: number;
    frames: { landmarks: FramingFrame["landmarks"] | null }[];
  };
}
const posed = (frames: { landmarks: FramingFrame["landmarks"] | null }[]) =>
  frames.filter((f) => f.landmarks) as FramingFrame[];

/** A stick figure: two points (head, feet) plus a raised hand. */
function figure(points: [number, number][]): FramingFrame {
  return { landmarks: points.map(([x, y]) => ({ x, y, visibility: 1 })) };
}

describe("computeShotFraming", () => {
  const frames = [
    figure([
      [0.5, 0.3],
      [0.5, 0.8],
    ]),
    figure([
      [0.52, 0.2],
      [0.5, 0.8],
    ]), // reaching up
    figure([
      [0.48, 0.35],
      [0.5, 0.85],
    ]), // dipping
  ];

  it("uses one uniform scale (no stretch) and keeps proportions", () => {
    const f = computeShotFraming(
      frames,
      { width: 300, height: 400 },
      { width: 1080, height: 1920 },
    )!;
    const p = projectWith(f);
    // A vertical unit and a horizontal unit of SOURCE PIXELS map to equal px.
    const a = p({ x: 0, y: 0 });
    const right = p({ x: 1 / 1080, y: 0 });
    const down = p({ x: 0, y: 1 / 1920 });
    expect(right.x - a.x).toBeCloseTo(down.y - a.y, 9);
    expect(f.approximate).toBe(false);
  });

  it("fits the whole movement: highest and lowest points just inside", () => {
    const stage = { width: 300, height: 400 };
    const f = computeShotFraming(frames, stage, { width: 1080, height: 1920 })!;
    const p = projectWith(f);
    const b = shotBounds(frames)!;
    const top = p({ x: 0.5, y: b.minY }).y;
    const bottom = p({ x: 0.5, y: b.maxY }).y;
    expect(top).toBeGreaterThan(0);
    expect(bottom).toBeLessThan(stage.height);
    // Tall movement in a portrait stage: height-limited, ~6% margins.
    expect(top / stage.height).toBeLessThan(0.08);
    expect(1 - bottom / stage.height).toBeLessThan(0.08);
  });

  it("is the same transform for every frame (no per-frame recentering)", () => {
    const stage = { width: 300, height: 400 };
    const a = computeShotFraming(frames, stage, { width: 1080, height: 1920 });
    const b = computeShotFraming([...frames].reverse(), stage, {
      width: 1080,
      height: 1920,
    });
    expect(a).toEqual(b);
  });

  it("places the source frame (video) with the same transform", () => {
    const f = computeShotFraming(
      frames,
      { width: 300, height: 400 },
      { width: 1080, height: 1920 },
    )!;
    const r = sourceRect(f);
    const p = projectWith(f);
    expect(p({ x: 0, y: 0 })).toEqual({ x: r.left, y: r.top });
    const br = p({ x: 1, y: 1 });
    expect(br.x).toBeCloseTo(r.left + r.width, 9);
    expect(br.y).toBeCloseTo(r.top + r.height, 9);
    expect(r.width / r.height).toBeCloseTo(1080 / 1920, 9);
  });

  it("ignores invisible joints and returns null with nothing to frame", () => {
    const ghost: FramingFrame = {
      landmarks: [{ x: 0, y: 0, visibility: 0.1 }],
    };
    expect(
      computeShotFraming([ghost], { width: 300, height: 400 }, null),
    ).toBeNull();
  });
});

describe("estimateAspect (shots saved without their size)", () => {
  for (const id of ["20201212_134104", "20190103_180930"]) {
    it(`recovers the portrait 9:16 source of ${id}`, () => {
      const fx = fixture(id);
      expect(fx.width / fx.height).toBeCloseTo(9 / 16, 2);
      const est = estimateAspect(posed(fx.frames).slice(60, 140));
      expect(est).toBeCloseTo(9 / 16, 5);
    });
  }

  it("legacy framing is marked approximate but still undistorted", () => {
    const fx = fixture("20201212_134104");
    const f = computeShotFraming(
      posed(fx.frames).slice(75, 113),
      { width: 300, height: 400 },
      null,
    )!;
    expect(f.approximate).toBe(true);
    expect(f.aspect).toBeCloseTo(9 / 16, 5);
  });

  it("always gets portrait vs landscape right on a mixed-angle session", () => {
    const fx = fixture("20190804_140654");
    const est = estimateAspect(posed(fx.frames))!;
    expect(est).toBeLessThan(1);
  });

  it("returns null when there's too little to measure", () => {
    expect(estimateAspect([figure([[0.5, 0.5]])])).toBeNull();
  });
});
