import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PoseData } from "basketball-shot-analysis";
import { profileForLevel } from "$lib/features/assessment";
import type { AnalyzeOptions } from "$lib/features/analysis";
import type { LiveTargetsV3 } from "basketball-shot-analysis";
import {
  POSE_PAD_AFTER,
  POSE_PAD_BEFORE,
  ensureV3,
  scoreShotV3,
  v3ForPoses,
} from "$lib/features/scoring/v3";
import {
  allowedOrientations,
  analyzeAndScore,
  scorecardForShot,
} from "../core";

// Real assets (tests run with cwd = app/).
const targets = JSON.parse(
  readFileSync(
    join(process.cwd(), "static", "reference", "live-targets-v3.json"),
    "utf8",
  ),
) as LiveTargetsV3;
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

    const { scorecard, worst, analysis, reviewPoses } = shots[0]!;
    // v3: the four phases, in shot order, on the 0–10+ scale.
    expect(scorecard.phases.map((p) => p.phase)).toEqual([
      "load",
      "rise",
      "setPoint",
      "release",
    ]);
    for (const p of scorecard.phases) {
      for (const m of p.metrics) {
        if (m.score !== null) expect(m.score).toBeGreaterThanOrEqual(0);
      }
    }
    // Worst: off-target scored metrics, worst first.
    for (const w of worst) expect(w.score!).toBeGreaterThan(0);
    for (let i = 1; i < worst.length; i++) {
      expect(worst[i - 1]!.score!).toBeGreaterThanOrEqual(worst[i]!.score!);
    }
    // The shot's phases were found, and v3 travels with the analysis.
    expect(analysis.v3Metrics).toBeDefined();
    expect(analysis.v3Metrics!.phases.rise).not.toBeNull();
    expect(scorecard.overall).not.toBeNull();

    // Review poses: the shot's frame range plus context on each side (as far
    // as the window allows), aligned with the analysis indexes.
    const first = reviewPoses.frames[0]!.frameIndex;
    const last = reviewPoses.frames.at(-1)!.frameIndex;
    expect(first).toBe(
      Math.max(0, analysis.frameRange.start - POSE_PAD_BEFORE),
    );
    expect(last).toBeLessThanOrEqual(analysis.frameRange.end + POSE_PAD_AFTER);
    expect(last).toBeGreaterThan(analysis.frameRange.end);
    expect(reviewPoses.fps).toBe(pose.fps);
    // Real capture times (ms) travel with each frame.
    expect(typeof reviewPoses.frames[0]!.t).toBe("number");
    // The source size travels with the poses so the review can draw them
    // undistorted (the fixture is portrait 1080×1920).
    expect(reviewPoses.width).toBe(1080);
    expect(reviewPoses.height).toBe(1920);
  });

  it("a recompute from the stored pose track equals what live stored", () => {
    const { shots } = analyzeAndScore(pose, opts, targets);
    const { analysis, reviewPoses } = shots[0]!;
    // Round-trip the track through JSON, as storage does.
    const stored = JSON.parse(JSON.stringify(reviewPoses));
    const again = v3ForPoses(stored, "right");
    for (const [id, m] of Object.entries(analysis.v3Metrics!.metrics)) {
      const r = again.metrics[id]!;
      expect(r.reliable, id).toBe(m.reliable);
      if (m.reliable) expect(r.value, id).toBeCloseTo(m.value, 6);
    }
    // And a v1 shot (no v3) is migrated to the same scorecard.
    const { v3Metrics: _drop, ...v1 } = analysis;
    const migrated = ensureV3(v1, stored, "right")!;
    expect(migrated.recomputed).toBe(true);
    expect(scorecardForShot(migrated.analysis, targets)!.overall).toBeCloseTo(
      scoreShotV3(analysis.v3Metrics!.metrics, targets).overall!,
      6,
    );
    // Already v3 → untouched; no pose track → can't migrate.
    expect(ensureV3(analysis, null, "right")!.recomputed).toBe(false);
    expect(ensureV3(v1, null, "right")).toBeNull();
    expect(scorecardForShot(v1, targets)).toBeNull();
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

  it("reads the near side as the shooting side for an accepted shot", () => {
    const { shots } = analyzeAndScore(pose, opts, targets);
    expect(shots[0]!.analysis.v3Metrics!.nearSide).toBe("right");
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
