import { describe, expect, it } from "vitest";
import { builtInBenchmarks, METRIC_NAMES } from "$lib/features/benchmarks";
import { scoreRep, scoreSession } from "$lib/features/scoring";
import { makeShotAnalysis } from "$lib/shared/testing/fixtures";
import type { ShotAnalysis } from "basketball-shot-analysis";
import { diagnose } from "../engine";
import {
  ISSUE_GROUP_INFO,
  ISSUE_GROUPS,
  issueGroupForMetric,
} from "../issue-groups";

const bench = builtInBenchmarks()[0]!;

function diagnoseShots(shots: ShotAnalysis[]) {
  const reps = shots.map((s) => scoreRep(s, bench));
  const session = scoreSession(reps, shots, bench);
  return diagnose(session, reps, bench);
}

describe("issue groups mapping", () => {
  it("assigns every one of the 26 metrics to exactly one group", () => {
    const seen = new Map<string, string>();
    for (const group of ISSUE_GROUPS) {
      for (const metric of ISSUE_GROUP_INFO[group].metrics) {
        expect(seen.has(metric), `${metric} in two groups`).toBe(false);
        seen.set(metric, group);
      }
    }
    for (const metric of METRIC_NAMES) {
      expect(seen.has(metric), `${metric} unassigned`).toBe(true);
      expect(issueGroupForMetric(metric)).toBe(seen.get(metric));
    }
    expect(seen.size).toBe(METRIC_NAMES.length);
  });

  it("every group has display copy", () => {
    for (const group of ISSUE_GROUPS) {
      expect(ISSUE_GROUP_INFO[group].displayName.length).toBeGreaterThan(0);
      expect(ISSUE_GROUP_INFO[group].whyItMatters.length).toBeGreaterThan(30);
    }
  });
});

describe("diagnose", () => {
  it("ranks a badly-failing high-priority group first", () => {
    // Alignment (high-priority elbow flare) is way off; posture (low
    // priority headTilt) is mildly off.
    const shots = [0, 1, 2].map(() =>
      makeShotAnalysis({
        metrics: {
          shootingElbowFlare: { value: 45, confidence: 0.95 }, // disaster
          headTilt: { value: 7, confidence: 0.9 }, // mild
          kneeFlexion: { value: 45, confidence: 0.9 }, // perfect
        },
      }),
    );
    const areas = diagnoseShots(shots);
    expect(areas[0]?.issueGroup).toBe("alignment");
    expect(areas[0]?.surfaced).toBe(true);
    expect(areas[0]?.metrics[0]?.metric).toBe("shootingElbowFlare");
    expect(areas[0]?.metrics[0]?.direction).toBe("high");
    expect(areas[0]?.metrics[0]?.feedback).toBeTruthy();

    const alignment = areas.find((a) => a.issueGroup === "alignment")!;
    const lowerBody = areas.find((a) => a.issueGroup === "lower-body")!;
    expect(alignment.severity).toBeGreaterThan(lowerBody.severity);
  });

  it("weights make a failing high-priority metric outrank a worse low-priority one", () => {
    // shootingElbowAngle (HIGH priority, alignment) mildly off vs
    // ballBehindHead (LOW priority, ball-path) scored worse:
    //   elbow score ~0.63 → sev ≈ 0.45·0.37 + 0.25·1    ≈ 0.415
    //   bBH   score  0.5  → sev ≈ 0.45·0.5  + 0.25·(1/3) ≈ 0.308
    // Priority weighting must put alignment ahead of ball-path.
    const bbhTarget = bench.targets.ballBehindHead!;
    const bbhAtBound = Array.isArray(bbhTarget.acceptable)
      ? 0
      : bbhTarget.acceptable.max; // score exactly 0.5
    const shots = [0, 1, 2].map(() =>
      makeShotAnalysis({
        metrics: {
          shootingElbowAngle: { value: 93.8, confidence: 0.9 },
          ballBehindHead: { value: bbhAtBound, confidence: 0.9 },
        },
      }),
    );
    const areas = diagnoseShots(shots);
    const alignment = areas.find((a) => a.issueGroup === "alignment")!;
    const ballPath = areas.find((a) => a.issueGroup === "ball-path")!;
    const elbow = alignment.metrics.find(
      (m) => m.metric === "shootingElbowAngle",
    )!;
    const bbh = ballPath.metrics.find((m) => m.metric === "ballBehindHead")!;
    expect(elbow.meanScore).toBeGreaterThan(bbh.meanScore); // less wrong…
    expect(elbow.severity).toBeGreaterThan(bbh.severity); // …but higher severity
  });

  it("collapses correlated metrics into one group", () => {
    const shots = [0, 1, 2].map(() =>
      makeShotAnalysis({
        metrics: {
          ballLegSync: { value: 40, confidence: 0.9 },
          legRiseStart: { value: 80, confidence: 0.9 },
          ballRiseStart: { value: 80, confidence: 0.9 },
        },
      }),
    );
    const areas = diagnoseShots(shots);
    const rhythm = areas.find((a) => a.issueGroup === "rhythm")!;
    const rhythmMetrics = rhythm.metrics.map((m) => m.metric);
    for (const m of ["ballLegSync", "legRiseStart", "ballRiseStart"]) {
      expect(rhythmMetrics).toContain(m);
    }
    expect(areas.filter((a) => a.issueGroup === "rhythm")).toHaveLength(1);
  });

  it("breaks severity ties alphabetically by group id", () => {
    // Two groups with identical single-metric evidence: same priority,
    // same score. guideHandPosition (guide-hand, high pri, categorical
    // miss 0.25) vs handCupVsHinge (release-follow-through… also
    // categorical). Check their severities equal → alphabetical order.
    const shots = [0, 1, 2].map(() =>
      makeShotAnalysis({
        metrics: {
          guideHandPosition: { value: "under", confidence: 0.9 },
          handCupVsHinge: { value: "cup", confidence: 0.9 },
        },
      }),
    );
    const areas = diagnoseShots(shots);
    const a = areas.find((x) => x.issueGroup === "guide-hand")!;
    const b = areas.find((x) => x.issueGroup === "release-follow-through")!;
    if (Math.abs(a.severity - b.severity) < 1e-9) {
      expect(a.rank).toBeLessThan(b.rank); // guide-hand < release-… alphabetically
    }
    expect(areas.map((x) => x.rank)).toEqual(
      areas.map((_, i) => i + 1), // ranks are 1..N in order
    );
  });

  it("only the top 3 groups are surfaced", () => {
    // Touch metrics in 5 different groups.
    const shots = [0, 1, 2].map(() =>
      makeShotAnalysis({
        metrics: {
          shootingElbowFlare: { value: 30, confidence: 0.9 },
          kneeFlexion: { value: 70, confidence: 0.9 },
          headTilt: { value: 10, confidence: 0.9 },
          ballPath: { value: 0.6, confidence: 0.9 },
          guideHandRelease: { value: 95, confidence: 0.9 },
        },
      }),
    );
    const areas = diagnoseShots(shots);
    expect(areas.length).toBeGreaterThanOrEqual(4);
    expect(areas.filter((a) => a.surfaced)).toHaveLength(3);
    expect(areas.slice(0, 3).every((a) => a.surfaced)).toBe(true);
  });

  it("high variance raises severity (variance term)", () => {
    const steady = [44, 45, 46].map((v) =>
      makeShotAnalysis({
        metrics: { kneeFlexion: { value: v, confidence: 0.9 } },
      }),
    );
    const erratic = [30, 45, 60].map((v) =>
      makeShotAnalysis({
        metrics: { kneeFlexion: { value: v, confidence: 0.9 } },
      }),
    );
    const steadyArea = diagnoseShots(steady).find(
      (a) => a.issueGroup === "lower-body",
    )!;
    const erraticArea = diagnoseShots(erratic).find(
      (a) => a.issueGroup === "lower-body",
    )!;
    expect(erraticArea.severity).toBeGreaterThan(steadyArea.severity);
  });

  it("is deterministic on fixture-like input", () => {
    const shots = [0, 1, 2].map((i) =>
      makeShotAnalysis({
        shotIndex: i,
        metrics: {
          shootingElbowFlare: { value: 20 + i, confidence: 0.9 },
          kneeFlexion: { value: 50 + i * 2, confidence: 0.9 },
        },
      }),
    );
    const a = diagnoseShots(shots);
    const b = diagnoseShots(shots);
    expect(a).toEqual(b);
  });
});
