import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import {
  angleAt,
  bridgeGaps,
  computeSignals,
  smooth,
  type SignalFrame,
} from "./signals";
import {
  detectEvents,
  extremum,
  frameAt,
  onsetBefore,
  phaseWindows,
  reachFraction,
  valueAt,
} from "./events";
import {
  EVENT_PAD_AFTER,
  EVENT_PAD_BEFORE,
  LABEL_FOR_EVENT,
  isClippedStartLabel,
} from "./labeled";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("sub-frame primitives (synthetic signals with known answers)", () => {
  it("extremum: recovers a minimum between samples", () => {
    for (const t0 of [10, 10.3, 10.5, 9.8]) {
      const s = range(21).map((i) => (i - t0) ** 2);
      expect(extremum(s, 0, 20, "min")!).toBeCloseTo(t0, 6);
    }
  });

  it("onsetBefore: a movement that starts mid-frame is found within a frame", () => {
    for (const t0 of [18.2, 18.5, 19.7]) {
      // At rest, then constant speed toward a peak at 40.
      const s = range(45).map((i) => (i < t0 ? 0 : Math.min(i, 40) - t0));
      const on = onsetBefore(s, 40, 1, 0)!;
      expect(Math.abs(on - t0)).toBeLessThan(0.8);
    }
  });

  it("reachFraction: linear interpolation of a threshold crossing", () => {
    const s = range(11).map((i) => i * 10); // 0..100
    expect(reachFraction(s, 0, 10, 0.9)).toBeCloseTo(9, 9);
    expect(reachFraction(s, 0, 10, 0.55)).toBeCloseTo(5.5, 9);
    expect(valueAt(s, 2.5)).toBe(25);
  });

  it("smoothing does not move an extremum", () => {
    const s = range(31).map((i) => (i - 15.3) ** 2);
    expect(extremum(smooth(s), 0, 30, "min")!).toBeCloseTo(15.3, 1);
  });

  it("bridges short gaps only", () => {
    expect(bridgeGaps([1, null, null, 4])).toEqual([1, 2, 3, 4]);
    expect(bridgeGaps([1, null, null, null, null, 6])).toEqual([1, null, null, null, null, 6]);
  });
});

describe("aspect-correct angles", () => {
  it("a true right angle on a 16:9 frame reads 90° only with the aspect", () => {
    // Pixels: a tilted right angle at the elbow (axis-aligned ones survive
    // stretching): shoulder (760,400), elbow (960,600), wrist (1160,400).
    const W = 1920;
    const H = 1080;
    const lm = (x: number, y: number) => ({ x: x / W, y: y / H, visibility: 1 });
    const landmarks = Array.from({ length: 33 }, () => lm(0, 0));
    landmarks[12] = lm(760, 400);
    landmarks[14] = lm(960, 600);
    landmarks[16] = lm(1160, 400);
    const frames: SignalFrame[] = [{ frameIndex: 0, timestamp: 0, landmarks }];
    const sig = computeSignals(frames, { aspect: W / H, shootingHand: "right" });
    expect(sig.elbowAngle[0]).toBeCloseTo(90, 6);
    // Raw normalized coordinates (what v2 used) distort it.
    const raw = angleAt(landmarks[12]!, landmarks[14]!, landmarks[16]!);
    expect(Math.abs(raw - 90)).toBeGreaterThan(20);
  });
});

describe("events on the labeled corpus (agreement with human labels)", () => {
  const root = path.resolve(__dirname, "../../../test-data");
  const errs: Record<string, number[]> = {};
  let shots = 0;
  for (const dir of fs.existsSync(root) ? fs.readdirSync(root) : []) {
    const lp = path.join(root, dir, "labels.json");
    const pp = path.join(root, dir, "poses.json");
    if (!fs.existsSync(lp) || !fs.existsSync(pp)) continue;
    const L = JSON.parse(fs.readFileSync(lp, "utf8"));
    const P = JSON.parse(fs.readFileSync(pp, "utf8"));
    for (const s of L.shots ?? []) {
      if (!String(s.cameraOrientation).startsWith("side")) continue;
      shots++;
      const lo = Math.max(0, s.startFrame - EVENT_PAD_BEFORE);
      const hi = Math.min(P.frames.length - 1, s.endFrame + EVENT_PAD_AFTER);
      const sig = computeSignals(P.frames.slice(lo, hi + 1), {
        aspect: P.width / P.height,
        shootingHand: "right",
      });
      const ev = detectEvents(sig);
      const w = phaseWindows(ev);
      // Phase windows are ordered when present.
      if (w.load && w.rise) expect(w.rise.start).toBeGreaterThanOrEqual(w.load.end);
      if (w.rise && w.release) expect(w.release.start).toBe(w.rise.end);
      for (const [id, key] of LABEL_FOR_EVENT) {
        const label = s[key];
        if (typeof label !== "number" || isClippedStartLabel(key, label, s.startFrame)) continue;
        const v = ev[id];
        if (v !== null) (errs[key] ??= []).push(frameAt(sig, v) - label);
      }
    }
  }
  const within = (key: string, tol: number) => {
    const e = errs[key] ?? [];
    return e.filter((x) => Math.abs(x) <= tol).length / Math.max(1, e.length);
  };

  it("covers the labeled side-on corpus", () => {
    expect(shots).toBeGreaterThanOrEqual(30);
  });

  // Floors at today's measured agreement (eval-events-v3.ts prints the full
  // table) — a regression guard, not the end goal; see the plan's B-2.9 notes.
  it("set point: ≥ 85 % within 2 frames; typical error under a frame", () => {
    expect(within("set_point", 2)).toBeGreaterThanOrEqual(0.85);
    // Median, not mean: a few outlier shots shouldn't define "typical".
    const e = [...errs.set_point!].sort((a, b) => a - b);
    const median = e[Math.floor(e.length / 2)]!;
    expect(Math.abs(median)).toBeLessThan(1);
  });

  it("arm extension: ≥ 80 % within 2 frames", () => {
    expect(within("arms_fully_extended", 2)).toBeGreaterThanOrEqual(0.8);
  });

  it("ball rise start: ≥ 70 % within 2 frames", () => {
    expect(within("ball_starts_upward", 2)).toBeGreaterThanOrEqual(0.7);
  });

  it("overall: ≥ 70 % of labeled events within 2 frames", () => {
    const all = Object.values(errs).flat();
    expect(all.filter((x) => Math.abs(x) <= 2).length / all.length).toBeGreaterThanOrEqual(0.7);
  });
});
