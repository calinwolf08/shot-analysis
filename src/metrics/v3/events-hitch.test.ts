import { describe, expect, it } from "vitest";
import { detectEvents } from "./events";
import type { ShotSignals } from "./signals";

/**
 * Set point / arm extension with a hitch on the way up: the elbow bends,
 * opens a little, bends deep again, then extends. The small opening must not
 * be taken for the extension; a shallow wobble of an already-straight arm
 * must change nothing. Synthetic signals (30 fps) with known answers.
 */
function signals(elbow: number[]): ShotSignals {
  const n = elbow.length;
  // Hand: dips to frame 10, rises from 12 to its peak at 30, stays up.
  const wristY = Array.from({ length: n }, (_, i) =>
    i <= 10
      ? 0.5 + i * 0.006
      : i <= 12
        ? 0.56
        : i <= 30
          ? 0.56 - (i - 12) * 0.014
          : 0.308,
  );
  // Hips / knees: a plain dip and drive, irrelevant to the elbow.
  const hipY = Array.from(
    { length: n },
    (_, i) => 0.6 + 0.03 * Math.sin((Math.PI * Math.min(i, 20)) / 20),
  );
  const knee = Array.from(
    { length: n },
    (_, i) => 170 - 40 * Math.sin((Math.PI * Math.min(i, 24)) / 24),
  );
  return {
    frameIndex: Array.from({ length: n }, (_, i) => i),
    t: Array.from({ length: n }, (_, i) => i / 30),
    wristY,
    hipY,
    kneeAngle: knee,
    elbowAngle: elbow,
  } as unknown as ShotSignals;
}

/** Piecewise-linear series through (frame, value) points. */
function path(points: [number, number][], n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = points.findIndex(([f]) => f >= i);
    if (j <= 0) out.push(points[Math.max(0, j)]![1]);
    else {
      const [f0, v0] = points[j - 1]!;
      const [f1, v1] = points[j]!;
      out.push(v0 + ((v1 - v0) * (i - f0)) / (f1 - f0));
    }
  }
  return out;
}

describe("set point and arm extension around a hitch", () => {
  it("a deep re-bend is the set point; the extension after it is the release", () => {
    // Bend to 63° (14), open to 79° (16), bend to 65° (19), extend to 174° (27).
    const elbow = path(
      [
        [0, 150],
        [10, 150],
        [14, 63],
        [16, 79],
        [19, 65],
        [27, 174],
        [40, 172],
      ],
      40,
    );
    const ev = detectEvents(signals(elbow));
    // After the small opening (16), at the deep re-bend (19).
    expect(ev.setPoint!).toBeGreaterThan(17.5);
    expect(ev.armExtended!).toBeGreaterThan(24);
    // At the release the arm is (nearly) straight, not at the hitch.
    expect(elbow[Math.round(ev.armExtended!)]!).toBeGreaterThan(150);
  });

  it("a shallow wobble of a nearly straight arm changes nothing", () => {
    // Bend to 34° (14), extend to 166° (20), wobble to 157° (21), on to 175° (26).
    const wobble = path(
      [
        [0, 150],
        [10, 150],
        [14, 34],
        [20, 166],
        [21, 157],
        [26, 175],
        [40, 172],
      ],
      40,
    );
    const clean = path(
      [
        [0, 150],
        [10, 150],
        [14, 34],
        [20, 166],
        [26, 175],
        [40, 172],
      ],
      40,
    );
    const a = detectEvents(signals(wobble));
    const b = detectEvents(signals(clean));
    expect(a.setPoint!).toBeLessThan(18);
    expect(Math.abs(a.setPoint! - b.setPoint!)).toBeLessThan(1);
  });
});
