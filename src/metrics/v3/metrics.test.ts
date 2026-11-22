import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { computeShotMetricsV3, type ShotMetricsV3 } from "./metrics";
import { computeSignals, type SignalFrame } from "./signals";
import { EVENT_PAD_AFTER, EVENT_PAD_BEFORE } from "./labeled";

type Lm = { x: number; y: number; z?: number; visibility: number };
type F = { frameIndex: number; timestamp: number; landmarks: Lm[] | null };

const root = path.resolve(__dirname, "../../../test-data/stephen-curry-1");
const P = JSON.parse(fs.readFileSync(path.join(root, "poses.json"), "utf8")) as {
  width: number;
  height: number;
  frames: F[];
};
const L = JSON.parse(fs.readFileSync(path.join(root, "labels.json"), "utf8")) as {
  shots: { startFrame: number; endFrame: number }[];
};
const shot = L.shots[1]!;
const window = P.frames.slice(
  shot.startFrame - EVENT_PAD_BEFORE,
  shot.endFrame + EVENT_PAD_AFTER + 1,
);
const base = computeShotMetricsV3(window as SignalFrame[], {
  aspect: P.width / P.height,
  shootingHand: "right",
});

/** Re-expresses the same pixel skeleton in another canvas / transform. */
function transform(
  frames: F[],
  from: { w: number; h: number },
  to: { w: number; h: number },
  map: (px: number, py: number) => [number, number],
): F[] {
  return frames.map((f) => ({
    ...f,
    landmarks: f.landmarks
      ? f.landmarks.map((l) => {
          const [x, y] = map(l.x * from.w, l.y * from.h);
          return { ...l, x: x / to.w, y: y / to.h };
        })
      : null,
  }));
}

function expectSame(a: ShotMetricsV3, b: ShotMetricsV3, tol = 1e-6) {
  expect(Object.keys(b.metrics).sort()).toEqual(Object.keys(a.metrics).sort());
  for (const [id, m] of Object.entries(a.metrics)) {
    const n = b.metrics[id]!;
    expect(n.reliable, id).toBe(m.reliable);
    if (m.reliable) expect(Math.abs(n.value - m.value), id).toBeLessThan(tol * Math.max(1, Math.abs(m.value)));
  }
}

describe("v3 metric catalog", () => {
  it("produces the agreed metric set for each phase", () => {
    const ids = Object.keys(base.metrics);
    for (const id of [
      "load.spine_angle", "load.head_pitch", "load.knee_depth", "load.hip_over_knee",
      "load.knee_over_ankle", "load.ball_drop", "load.elbow_angle", "load.elbow_change",
      "load.ball_close", "load.t_drop_start", "load.t_drop_end", "load.t_elbow_bend",
      "rise.t_start", "rise.t_end", "rise.elbow_change_1", "rise.elbow_change_2",
      "rise.wrist_hinge_change_1", "rise.wrist_hinge_change_2", "rise.spine_change",
      "rise.t_spine_vs_knees", "rise.head_pitch_change", "rise.t_ball_vs_knee_bottom",
      "setPoint.wrist_vs_head", "setPoint.elbow_angle", "setPoint.spine_angle",
      "setPoint.knee_angle", "setPoint.hip_angle", "setPoint.hip_over_knee",
      "setPoint.knee_over_ankle", "setPoint.head_pitch",
      "release.elbow_path", "release.wrist_vs_head_end", "release.guide_hand_dx",
      "release.guide_hand_dy", "release.knee_change", "release.spine_change",
      "release.wrist_snap", "release.forward_drift", "release.t_legs_vs_arm",
    ]) {
      expect(ids, id).toContain(id);
    }
    expect(ids.filter((i) => i.startsWith("detail."))).toHaveLength(4);
    expect(base.schemaVersion).toBe(4);
  });

  it("measures Curry's set-point elbow as a bent arm (aspect-correct)", () => {
    const e = base.metrics["setPoint.elbow_angle"]!;
    expect(e.reliable).toBe(true);
    expect(e.value).toBeLessThan(90);
  });

  it("flags timing over phases shorter than 6 frames as low resolution", () => {
    const rise = base.phases.rise!;
    expect(rise.end - rise.start).toBeLessThan(6);
    expect(base.metrics["rise.t_start"]!.note).toBe("low resolution");
  });

  it("head pitch: + = chin down, independent of torso lean", () => {
    // Drop the nose (chin down) relative to the ear → pitch rises.
    const chinDown = window.map((f) => ({
      ...f,
      landmarks: f.landmarks
        ? f.landmarks.map((l, i) => (i === 0 ? { ...l, y: l.y + 0.01 } : l))
        : null,
    }));
    const down = computeShotMetricsV3(chinDown as SignalFrame[], {
      aspect: P.width / P.height,
      shootingHand: "right",
    });
    expect(down.metrics["load.head_pitch"]!.value).toBeGreaterThan(
      base.metrics["load.head_pitch"]!.value + 5,
    );
    // Lean the whole upper body forward (rotate shoulders + head about the
    // hips): head pitch follows the head only. Here the head is moved without
    // rotating it, so pitch is unchanged while the torso lean changes.
    const shifted = window.map((f) => ({
      ...f,
      landmarks: f.landmarks
        ? f.landmarks.map((l, i) =>
            i <= 12 ? { ...l, x: l.x - 0.02 * base.facing } : l,
          )
        : null,
    }));
    const lean = computeShotMetricsV3(shifted as SignalFrame[], {
      aspect: P.width / P.height,
      shootingHand: "right",
    });
    expect(lean.metrics["load.spine_angle"]!.value).not.toBeCloseTo(
      base.metrics["load.spine_angle"]!.value,
      0,
    );
    expect(lean.metrics["load.head_pitch"]!.value).toBeCloseTo(
      base.metrics["load.head_pitch"]!.value,
      6,
    );
  });

  it("matches the golden snapshot (Curry shot 2)", () => {
    const rounded = Object.fromEntries(
      Object.entries(base.metrics).map(([id, m]) => [
        id,
        m.reliable ? Math.round(m.value * 1000) / 1000 : null,
      ]),
    );
    expect(rounded).toMatchSnapshot();
  });
});

describe("anatomy / camera invariance", () => {
  const land = { w: P.width, h: P.height };

  it("same body on a PORTRAIT canvas gives the same metrics (aspect fix)", () => {
    // Shrink to half size and place on a 1080×1920 portrait canvas.
    const portrait = { w: 1080, h: 1920 };
    const moved = transform(window, land, portrait, (x, y) => [x * 0.5 + 40, y * 0.5 + 600]);
    const m = computeShotMetricsV3(moved as SignalFrame[], {
      aspect: portrait.w / portrait.h,
      shootingHand: "right",
    });
    expectSame(base, m);
  });

  it("player size / distance from camera doesn't matter (×2 zoom)", () => {
    const big = { w: P.width * 2, h: P.height * 2 };
    const moved = transform(window, land, big, (x, y) => [x * 2, y * 2]);
    const m = computeShotMetricsV3(moved as SignalFrame[], { aspect: big.w / big.h, shootingHand: "right" });
    expectSame(base, m);
  });

  it("a mirrored left-handed shooter measures the same", () => {
    const pairs: [number, number][] = [
      [1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16],
      [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32],
    ];
    const swap = new Map<number, number>();
    for (const [a, b] of pairs) {
      swap.set(a, b);
      swap.set(b, a);
    }
    const mirrored = window.map((f) => ({
      ...f,
      landmarks: f.landmarks
        ? f.landmarks.map((_, i) => {
            const src = f.landmarks![swap.get(i) ?? i]!;
            return { ...src, x: 1 - src.x };
          })
        : null,
    }));
    const m = computeShotMetricsV3(mirrored as SignalFrame[], {
      aspect: P.width / P.height,
      shootingHand: "left",
    });
    expectSame(base, m);
  });
});

describe("reliability rules", () => {
  it("guide hand hidden → guide-hand metrics unmeasured", () => {
    const hidden = window.map((f) => ({
      ...f,
      landmarks: f.landmarks ? f.landmarks.map((l, i) => (i === 15 ? { ...l, visibility: 0.1 } : l)) : null,
    }));
    const m = computeShotMetricsV3(hidden as SignalFrame[], { aspect: P.width / P.height, shootingHand: "right" });
    expect(m.metrics["release.guide_hand_dx"]!.reliable).toBe(false);
    expect(m.metrics["release.guide_hand_dx"]!.note).toBe("guide hand hidden");
  });

  it("fingers hidden → wrist hinge / snap unmeasured", () => {
    const hidden = window.map((f) => ({
      ...f,
      landmarks: f.landmarks ? f.landmarks.map((l, i) => (i === 20 ? { ...l, visibility: 0.1 } : l)) : null,
    }));
    const m = computeShotMetricsV3(hidden as SignalFrame[], { aspect: P.width / P.height, shootingHand: "right" });
    expect(m.metrics["release.wrist_snap"]!.reliable).toBe(false);
    expect(m.metrics["rise.wrist_hinge_change_1"]!.reliable).toBe(false);
  });

  it("timestamps in ms or s give the same timing", () => {
    const secs = window.map((f) => ({ ...f, timestamp: f.timestamp / 1000 }));
    const m = computeShotMetricsV3(secs as SignalFrame[], { aspect: P.width / P.height, shootingHand: "right" });
    expectSame(base, m);
    const sig = computeSignals(window as SignalFrame[], { aspect: P.width / P.height, shootingHand: "right" });
    expect(sig.t[1]! - sig.t[0]!).toBeCloseTo(1 / 30, 6);
  });
});
