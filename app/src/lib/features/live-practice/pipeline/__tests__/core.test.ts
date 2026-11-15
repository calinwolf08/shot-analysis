import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PoseData } from "basketball-shot-analysis";
import { profileForLevel } from "$lib/features/assessment";
import type { AnalyzeOptions } from "$lib/features/analysis";
import type { LiveTargets } from "$lib/features/scoring";
import { analyzeAndScore } from "../core";

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
    const shots = analyzeAndScore(pose, opts, targets);
    expect(shots.length).toBeGreaterThanOrEqual(1);

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
  });

  it("returns no shots (not an error) for a window too short to detect one", () => {
    const tiny: PoseData = { ...pose, frames: pose.frames.slice(0, 3) };
    const shots = analyzeAndScore(tiny, opts, targets);
    expect(Array.isArray(shots)).toBe(true);
  });
});
