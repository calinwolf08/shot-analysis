import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PoseData } from "basketball-shot-analysis";
import { computeReferenceShots, type ReferenceLabels } from "../curry-model";
import {
  ALIGN_PAD_FRAMES,
  ALIGN_SPAN,
  frameAtPhaseTime,
  metricsForStoredShot,
  nearestFrame,
  phaseLabel,
  phaseTimeAtFrame,
  segmentAt,
  type PhaseAnchors,
} from "../phase-align";

const fast: PhaseAnchors = {
  loadStart: 10,
  loadEnd: 16,
  setPoint: 19,
  armExtended: 22,
};
const slow: PhaseAnchors = {
  loadStart: 100,
  loadEnd: 118,
  setPoint: 130,
  armExtended: 140,
};

describe("phase-time alignment", () => {
  it("maps every phase boundary 1:1 on both shots", () => {
    for (const a of [fast, slow]) {
      expect(frameAtPhaseTime(a, 0)).toBe(a.loadStart - ALIGN_PAD_FRAMES);
      expect(frameAtPhaseTime(a, 1)).toBe(a.loadStart);
      expect(frameAtPhaseTime(a, 2)).toBe(a.loadEnd);
      expect(frameAtPhaseTime(a, 3)).toBe(a.setPoint);
      expect(frameAtPhaseTime(a, 4)).toBe(a.armExtended);
      expect(frameAtPhaseTime(a, ALIGN_SPAN)).toBe(
        a.armExtended + ALIGN_PAD_FRAMES,
      );
    }
  });

  it("stretches within a phase linearly (half the rise = half on both)", () => {
    expect(frameAtPhaseTime(fast, 2.5)).toBeCloseTo(17.5);
    expect(frameAtPhaseTime(slow, 2.5)).toBeCloseTo(124);
  });

  it("phaseTimeAtFrame inverts frameAtPhaseTime and clamps", () => {
    for (const u of [0, 0.3, 1, 1.7, 2, 2.25, 3, 3.9, 5]) {
      expect(phaseTimeAtFrame(slow, frameAtPhaseTime(slow, u))).toBeCloseTo(u);
    }
    expect(phaseTimeAtFrame(fast, -100)).toBe(0);
    expect(phaseTimeAtFrame(fast, 1e6)).toBe(ALIGN_SPAN);
    expect(frameAtPhaseTime(fast, 99)).toBe(
      fast.armExtended + ALIGN_PAD_FRAMES,
    );
  });

  it("names the segment, boundaries belonging to the next phase", () => {
    expect(segmentAt(0.5)).toBe("Before");
    expect(segmentAt(1)).toBe("Load");
    expect(segmentAt(2.999)).toBe("Rise");
    expect(segmentAt(3)).toBe("Release");
    expect(segmentAt(5)).toBe("After");
  });

  it("labels a boundary with its event name", () => {
    expect(phaseLabel(3)).toBe("Release · at Set point");
    expect(phaseLabel(1.001)).toBe("Load · at Load starts");
    expect(phaseLabel(2.5)).toBe("Rise");
  });

  it("nearestFrame picks the closest stored frame", () => {
    const frames = [{ frameIndex: 3 }, { frameIndex: 5 }, { frameIndex: 9 }];
    expect(nearestFrame(frames, 6.9)?.frameIndex).toBe(5);
    expect(nearestFrame(frames, 7.1)?.frameIndex).toBe(9);
    expect(nearestFrame([], 1)).toBeNull();
  });

  it("every Curry reference shot has all four anchors, in order", () => {
    const dir = join(process.cwd(), "..", "test-data", "stephen-curry-1");
    const poses = JSON.parse(
      readFileSync(join(dir, "poses.json"), "utf8"),
    ) as PoseData;
    const labels = JSON.parse(
      readFileSync(join(dir, "labels.json"), "utf8"),
    ) as ReferenceLabels;
    const shots = computeReferenceShots(poses, labels, "right");
    for (const s of shots) {
      const a = s.anchors!;
      expect(a).not.toBeNull();
      expect(a.loadStart).toBeLessThan(a.loadEnd);
      expect(a.loadEnd).toBeLessThan(a.setPoint);
      expect(a.setPoint).toBeLessThan(a.armExtended);
    }
  });

  it("measures a stored shot from its review pose track (ms or frame clock)", () => {
    const dir = join(process.cwd(), "..", "test-data", "stephen-curry-1");
    const poses = JSON.parse(
      readFileSync(join(dir, "poses.json"), "utf8"),
    ) as PoseData;
    const labels = JSON.parse(
      readFileSync(join(dir, "labels.json"), "utf8"),
    ) as ReferenceLabels;
    const lab = labels.shots[0]!;
    const frames = poses.frames
      .slice(lab.startFrame - 10, lab.endFrame + 10)
      .filter((f) => f.landmarks)
      .map((f) => ({ frameIndex: f.frameIndex, landmarks: [...f.landmarks!] }));
    const stored = {
      fps: 30,
      width: poses.width,
      height: poses.height,
      frames,
    };
    const a = metricsForStoredShot(stored, "right");
    const b = metricsForStoredShot(
      {
        ...stored,
        frames: frames.map((f) => ({ ...f, t: (f.frameIndex / 30) * 1000 })),
      },
      "right",
    );
    expect(a.metrics.phases.rise).not.toBeNull();
    expect(a.metrics.metrics["setPoint.elbow_angle"]!.value).toBeCloseTo(
      b.metrics.metrics["setPoint.elbow_angle"]!.value,
      6,
    );
  });
});
