import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PoseData } from "basketball-shot-analysis";
import { profileForLevel } from "$lib/features/assessment";
import type { AnalyzeOptions } from "$lib/features/analysis";
import type { LiveTargets } from "$lib/features/scoring";
import { allowedOrientations, analyzeAndScore } from "../core";

// Real assets (tests run with cwd = app/).
const targets = JSON.parse(
  readFileSync(
    join(process.cwd(), "static", "reference", "live-targets.json"),
    "utf8",
  ),
) as LiveTargets;
const pose = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      "src-tests",
      "fixtures",
      "poses",
      "20201212_134104.json",
    ),
    "utf8",
  ),
) as PoseData;

const opts: AnalyzeOptions = {
  shootingHand: "right",
  profile: profileForLevel("high-school"),
};

describe("analyzeAndScore (isomorphic core)", () => {
  it("analyzes a pose window and scores each detected shot", () => {
    const { shots, rejected } = analyzeAndScore(pose, opts, targets);
    expect(shots.length).toBeGreaterThanOrEqual(1);
    expect(rejected).toEqual([]);
    // The fixture is side-on, shooting (right) arm nearest the camera.
    expect(shots[0]!.analysis.orientation).toBe("side-right");

    const { scorecard, worst } = shots[0]!;
    // Two top-level sections, Structure then Sequencing.
    expect(scorecard.sections.map((s) => s.section)).toEqual([
      "structure",
      "sequencing",
    ]);
    expect(scorecard.targetsVersion).toBe(targets.version);

    // Every scored metric sits on the 1..10 (lower-better) scale.
    for (const section of scorecard.sections) {
      for (const group of section.phases) {
        for (const m of group.metrics) {
          if (!m.scored) continue;
          expect(m.score).toBeGreaterThanOrEqual(1);
          expect(m.score).toBeLessThanOrEqual(10);
        }
      }
    }

    // Worst list: at most 5, each a scored + off-band metric.
    expect(worst.length).toBeLessThanOrEqual(5);
    for (const w of worst) {
      expect(w.scored).toBe(true);
      expect(w.inBand).toBe(false);
    }

    // Review poses span the shot's frame range and align with its indexes.
    const { analysis, reviewPoses } = shots[0]!;
    const span = analysis.frameRange.end - analysis.frameRange.start + 1;
    expect(reviewPoses.frames).toHaveLength(span);
    expect(reviewPoses.frames[0]!.frameIndex).toBe(analysis.frameRange.start);
    expect(reviewPoses.frames.at(-1)!.frameIndex).toBe(analysis.frameRange.end);
    expect(reviewPoses.fps).toBe(pose.fps);
    // The source size travels with the poses so the review can draw them
    // undistorted (the fixture is portrait 1080×1920).
    expect(reviewPoses.width).toBe(1080);
    expect(reviewPoses.height).toBe(1920);
  });

  it("omits the size when the pose data doesn't know it (1×1 placeholder)", () => {
    const unknown: PoseData = { ...pose, width: 1, height: 1 };
    const { shots } = analyzeAndScore(unknown, opts, targets);
    expect(shots[0]!.reviewPoses.width).toBeUndefined();
  });

  it("returns no shots (not an error) for a window too short to detect one", () => {
    const tiny: PoseData = { ...pose, frames: pose.frames.slice(0, 3) };
    const { shots } = analyzeAndScore(tiny, opts, targets);
    expect(Array.isArray(shots)).toBe(true);
  });
});

describe("orientation gate", () => {
  const load = (id: string) =>
    JSON.parse(
      readFileSync(
        join(process.cwd(), "src-tests", "fixtures", "poses", `${id}.json`),
        "utf8",
      ),
    ) as PoseData;

  it("allows only the shooting-arm side", () => {
    expect(allowedOrientations("right")).toEqual(["side-right"]);
    expect(allowedOrientations("left")).toEqual(["side-left"]);
  });

  it("rejects the same side-right shot for a left-handed shooter", () => {
    const { shots, rejected } = analyzeAndScore(
      pose,
      { ...opts, shootingHand: "left" },
      targets,
    );
    expect(shots).toEqual([]);
    expect(rejected.length).toBeGreaterThanOrEqual(1);
    expect(rejected[0]).toMatchObject({
      reason: "orientation",
      orientation: "side-right",
      allowed: ["side-left"],
    });
  });

  it("keeps only side-right shots from a mixed-angle session", () => {
    // Labeled: side-left, behind-left ×2, behind, behind-right, side-right ×2.
    const mixed = load("20190804_140654");
    const { shots, rejected } = analyzeAndScore(mixed, opts, targets);
    expect(shots.length).toBeGreaterThanOrEqual(1);
    expect(shots.every((s) => s.analysis.orientation === "side-right")).toBe(
      true,
    );
    expect(rejected.length).toBeGreaterThanOrEqual(3);
    expect(rejected.every((r) => r.orientation !== "side-right")).toBe(true);
  });

  it("measures posture as side-on for an accepted shot", () => {
    const { shots } = analyzeAndScore(pose, opts, targets);
    const v2 = shots[0]!.analysis.v2Metrics!;
    expect(v2.reliability.sideView).toBe(true);
  });
});

describe("one shot per rep (focusIndex)", () => {
  // Labeled: side-right [84-111], front [245-270], front-right [392-418].
  const multi = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "src-tests",
        "fixtures",
        "poses",
        "20190103_180930.json",
      ),
      "utf8",
    ),
  ) as PoseData;

  it("without a focus, every detected shot is considered", () => {
    const { shots, rejected } = analyzeAndScore(multi, opts, targets);
    expect(shots.length + rejected.length).toBe(3);
  });

  it("keeps only the shot at the rep trigger", () => {
    const { shots, rejected } = analyzeAndScore(
      multi,
      opts,
      targets,
      undefined,
      95,
    );
    expect(shots).toHaveLength(1);
    expect(rejected).toEqual([]);
    expect(shots[0]!.analysis.orientation).toBe("side-right");
  });

  it("gates the focused shot alone (a front-on rep isn't replaced by another)", () => {
    const { shots, rejected } = analyzeAndScore(
      multi,
      opts,
      targets,
      undefined,
      255,
    );
    expect(shots).toEqual([]);
    expect(rejected).toHaveLength(1);
  });
});
