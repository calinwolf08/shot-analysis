import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { EVENT_PAD_AFTER, EVENT_PAD_BEFORE } from "../v3/labeled";
import type { SignalFrame } from "../v3/signals";
import {
  ALL_CHECK_KEYS,
  CHECKS,
  CHECK_DEFS,
  KEYFRAMES,
  checkKey,
  parseCheckKey,
} from "./catalog";
import { computeShotKeyframes, type ShotKeyframes } from "./measure";
import { MIN_RAMP, buildKeyframeTargets, scoreCheck } from "./targets";

type Lm = { x: number; y: number; z?: number; visibility: number };
type F = { frameIndex: number; timestamp: number; landmarks: Lm[] | null };

const root = path.resolve(__dirname, "../../../test-data/stephen-curry-1");
const P = JSON.parse(
  fs.readFileSync(path.join(root, "poses.json"), "utf8"),
) as {
  width: number;
  height: number;
  frames: F[];
};
const L = JSON.parse(
  fs.readFileSync(path.join(root, "labels.json"), "utf8"),
) as {
  shots: ({ startFrame: number; endFrame: number } & Record<string, number>)[];
};
const windowOf = (s: { startFrame: number; endFrame: number }) =>
  P.frames.slice(
    Math.max(0, s.startFrame - EVENT_PAD_BEFORE),
    s.endFrame + EVENT_PAD_AFTER + 1,
  );
const measure = (frames: F[], aspect = P.width / P.height) =>
  computeShotKeyframes(frames as SignalFrame[], {
    aspect,
    shootingHand: "right",
  });
const shots: ShotKeyframes[] = L.shots.map((s) => measure(windowOf(s)));

describe("keyframe catalog", () => {
  it("has the agreed 33 checks, every one with a name, help and both phrases", () => {
    expect(ALL_CHECK_KEYS).toHaveLength(33);
    for (const c of CHECKS) {
      const d = CHECK_DEFS[c];
      expect(d.name, c).toBeTruthy();
      expect(d.help, c).toBeTruthy();
      expect(d.low, c).toMatch(/ too /);
      expect(d.high, c).toMatch(/ too /);
      expect(d.keyframes.length, c).toBeGreaterThan(0);
    }
    expect(CHECK_DEFS.ball_close.keyframes).toEqual(["setup", "load"]);
    expect(CHECK_DEFS.hold.keyframes).toEqual(["setPoint"]);
  });

  it("parses only check ids that exist at that keyframe", () => {
    expect(parseCheckKey("rise.knee_bend")).toEqual({
      keyframe: "rise",
      check: "knee_bend",
    });
    expect(parseCheckKey("rise.ball_close")).toBeNull();
    expect(parseCheckKey("follow.knee_bend")).toBeNull();
    expect(parseCheckKey("load.head_pitch")).toBeNull();
    for (const k of ALL_CHECK_KEYS) {
      const p = parseCheckKey(k)!;
      expect(checkKey(p.keyframe, p.check)).toBe(k);
    }
  });
});

describe("keyframe detection (Curry reference shots)", () => {
  it("finds all five keyframes, in shot order", () => {
    for (const s of shots) {
      const kf = KEYFRAMES.map((k) => s.keyframes[k]);
      expect(kf.every((x) => x !== null)).toBe(true);
      for (let i = 1; i < kf.length; i++)
        expect(kf[i]!).toBeGreaterThanOrEqual(kf[i - 1]!);
    }
  });

  it("agrees with the hand labels where there are some", () => {
    // Labels are whole frames at 30 fps; fast moments can be a frame or two off.
    L.shots.forEach((label, i) => {
      const s = shots[i]!;
      expect(
        Math.abs(s.keyframes.setPoint! - label.set_point!),
        `shot ${i} set point`,
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(s.keyframes.release! - label.arms_fully_extended!),
        `shot ${i} release`,
      ).toBeLessThanOrEqual(3);
    });
    // Load is v3's ball-rise start (the turn is often a flat stretch): same bar as v3.
    const nearLoad = L.shots.filter(
      (label, i) =>
        Math.abs(shots[i]!.keyframes.load! - label.ball_starts_upward!) <= 2,
    );
    expect(nearLoad.length / L.shots.length).toBeGreaterThanOrEqual(0.7);
  });

  it("measures (nearly) every check, and the hold is never negative", () => {
    for (const s of shots) {
      expect(Object.keys(s.checks).sort()).toEqual([...ALL_CHECK_KEYS].sort());
      const reliable = Object.values(s.checks).filter((c) => c.reliable).length;
      // The shooting elbow / wrist can be hidden at Setup (ball in front of the body).
      expect(reliable).toBeGreaterThanOrEqual(31);
      expect(s.checks["setPoint.hold"]!.value).toBeGreaterThanOrEqual(0);
    }
  });

  it("reads sensible positions at the extremes of the shot", () => {
    for (const s of shots) {
      const v = (id: string) => s.checks[id]!.value;
      // Knees bend into the load and straighten by the release.
      expect(v("load.knee_bend")).toBeLessThan(v("release.knee_bend"));
      // The elbow is folded at set point and nearly straight at release.
      expect(v("setPoint.elbow_bend")).toBeLessThan(100);
      expect(v("release.elbow_bend")).toBeGreaterThan(145);
      // Hands go from hip height to above the head.
      expect(v("release.hand_height")).toBeGreaterThan(0.3);
    }
  });

  it("is independent of the canvas size and aspect (same pixels, other frame)", () => {
    const s = L.shots[1]!;
    const frames = windowOf(s);
    // Pad the canvas: 1920×1080 → 2400×1600, skeleton shifted by (200, 300) px.
    const to = { w: 2400, h: 1600 };
    const moved = frames.map((f) => ({
      ...f,
      landmarks: f.landmarks
        ? f.landmarks.map((l) => ({
            ...l,
            x: (l.x * P.width + 200) / to.w,
            y: (l.y * P.height + 300) / to.h,
          }))
        : null,
    }));
    const a = measure(frames);
    const b = measure(moved, to.w / to.h);
    for (const [id, c] of Object.entries(a.checks)) {
      const d = b.checks[id]!;
      expect(d.reliable, id).toBe(c.reliable);
      if (c.reliable)
        expect(Math.abs(d.value - c.value), id).toBeLessThan(
          1e-6 * Math.max(1, Math.abs(c.value)),
        );
    }
  });
});

describe("keyframe targets", () => {
  const targets = buildKeyframeTargets(shots, {
    builtFrom: "test",
    shootingHand: "right",
    generatedAt: "x",
  });

  it("has a target for every check; needs 3+ reference values to score", () => {
    expect(Object.keys(targets.checks).sort()).toEqual(
      [...ALL_CHECK_KEYS].sort(),
    );
    for (const t of Object.values(targets.checks)) {
      expect(t.scored).toBe(t.n >= 3);
      expect(t.passMin).toBeLessThanOrEqual(t.passMax);
      expect(t.rampSd).toBeGreaterThanOrEqual(MIN_RAMP[t.unit]);
    }
  });

  it("scores 0 inside the band and 1 per spread outside, with a direction", () => {
    const t = targets.checks["rise.knee_bend"]!;
    expect(
      scoreCheck(t, { value: (t.passMin + t.passMax) / 2, reliable: true }),
    ).toMatchObject({ score: 0, direction: null });
    const low = scoreCheck(t, {
      value: t.passMin - 2 * t.rampSd,
      reliable: true,
    });
    expect(low.direction).toBe("low");
    expect(low.score).toBeCloseTo(2, 6);
    expect(
      scoreCheck(t, { value: t.passMax + t.rampSd, reliable: true }).direction,
    ).toBe("high");
    expect(scoreCheck(t, { value: NaN, reliable: false }).score).toBeNull();
    expect(scoreCheck(t, undefined).score).toBeNull();
  });

  it("keeps hand-set overrides across rebuilds", () => {
    const prev = {
      checks: {
        ...targets.checks,
        "setPoint.hold": {
          ...targets.checks["setPoint.hold"]!,
          override: { passMax: 0.3 },
        },
      },
    };
    const again = buildKeyframeTargets(
      shots,
      { builtFrom: "test", shootingHand: "right" },
      prev,
    );
    expect(again.checks["setPoint.hold"]!.override).toEqual({ passMax: 0.3 });
    expect(
      scoreCheck(again.checks["setPoint.hold"]!, { value: 0.2, reliable: true })
        .score,
    ).toBe(0);
  });
});
