/**
 * Tests for ShotAnalyzer.analyzePoses — the poses-only analysis path that
 * skips MediaPipe extraction. Drives real labeled pose data from test-data/ so
 * the validator's "load poses, run analysis" flow is exercised end to end.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { ShotAnalyzer } from "./analyzer";
import { createConfig } from "./config";
import type { VideoMetadata } from "./metrics/types";

const POSES_PATH = path.join(
  __dirname,
  "..",
  "test-data",
  "20190103_180930",
  "poses.json",
);

function loadPoses() {
  const raw = JSON.parse(fs.readFileSync(POSES_PATH, "utf8"));
  const videoMetadata: VideoMetadata = {
    width: raw.width,
    height: raw.height,
    fps: raw.fps,
    totalFrames: raw.totalFrames,
  };
  return { frames: raw.frames, videoMetadata };
}

describe("ShotAnalyzer.analyzePoses", () => {
  it("runs analysis from pre-extracted poses without initialize()", () => {
    const { frames, videoMetadata } = loadPoses();
    // No initialize() — no pose model is loaded on the poses-only path.
    const analyzer = new ShotAnalyzer(
      createConfig({ shootingHand: "right", profile: "high-school" }),
    );

    const result = analyzer.analyzePoses(frames, videoMetadata);

    expect(result.shots.length).toBeGreaterThan(0);
    expect(result.videoMetadata.fps).toBe(videoMetadata.fps);

    for (const shot of result.shots) {
      // Phases are derived and metrics are populated per shot.
      expect(shot.phases).toBeDefined();
      expect(Object.keys(shot.metrics).length).toBeGreaterThan(0);
      expect(shot.frameRange.end).toBeGreaterThan(shot.frameRange.start);
    }
  });

  it("returns empty shots for a too-short pose sequence", () => {
    const { frames, videoMetadata } = loadPoses();
    const analyzer = new ShotAnalyzer(createConfig({ shootingHand: "right" }));
    const result = analyzer.analyzePoses(frames.slice(0, 1), videoMetadata);
    expect(result.shots).toEqual([]);
  });
});
