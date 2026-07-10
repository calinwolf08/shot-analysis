import { describe, expect, it } from "vitest";
import { builtInBenchmarks } from "$lib/features/benchmarks";
import { makeShotAnalysis } from "$lib/shared/testing/fixtures";
import { selectCues } from "../cues";
import { scoreRep } from "../engine";

const bench = builtInBenchmarks()[0]!;

describe("selectCues", () => {
  it("returns no cues for an all-pass rep", () => {
    const rep = scoreRep(
      makeShotAnalysis({
        metrics: {
          shootingElbowAngle: { value: 90, confidence: 0.9 },
        },
      }),
      bench,
    );
    // Other default fixture metrics may fail; restrict to a rep with only
    // passing metrics:
    const onlyPass = {
      ...rep,
      perMetric: Object.fromEntries(
        Object.entries(rep.perMetric).filter(
          ([, m]) => m && m.status === "pass",
        ),
      ),
    };
    const cues = selectCues(onlyPass, bench);
    expect(cues.primary).toBeNull();
    expect(cues.secondary).toEqual([]);
  });

  it("picks the worst weighted problem as primary with ≤ 2 secondary", () => {
    const rep = scoreRep(
      makeShotAnalysis({
        metrics: {
          // way off + high priority → should be primary
          shootingElbowFlare: { value: 45, confidence: 0.95 },
          // mildly off, low weight
          headTilt: { value: 14, confidence: 0.9 },
          kneeFlexion: { value: 100, confidence: 0.9 },
        },
      }),
      bench,
    );
    const cues = selectCues(rep, bench);
    expect(cues.primary?.metric).toBe("shootingElbowFlare");
    expect(cues.primary?.text).toBe(bench.targets.shootingElbowFlare!.shortCue);
    expect(cues.secondary.length).toBeLessThanOrEqual(2);
    expect(cues.primary?.feedback).toBeTruthy();
  });

  it("prioritizes the plan focus metric even when it is not the worst", () => {
    const rep = scoreRep(
      makeShotAnalysis({
        metrics: {
          shootingElbowFlare: { value: 45, confidence: 0.95 }, // worst
          kneeFlexion: { value: 52, confidence: 0.9 }, // mild, focus
        },
      }),
      bench,
    );
    const cues = selectCues(rep, bench, "kneeFlexion");
    expect(cues.primary?.metric).toBe("kneeFlexion");
    expect(cues.secondary[0]?.metric).toBe("shootingElbowFlare");
  });

  it("skips the focus metric when it passes", () => {
    const rep = scoreRep(
      makeShotAnalysis({
        metrics: {
          shootingElbowFlare: { value: 45, confidence: 0.95 },
          kneeFlexion: { value: 45, confidence: 0.9 }, // at ideal → pass
        },
      }),
      bench,
    );
    const cues = selectCues(rep, bench, "kneeFlexion");
    expect(cues.primary?.metric).toBe("shootingElbowFlare");
  });

  it("carries direction-appropriate feedback text", () => {
    const rep = scoreRep(
      makeShotAnalysis({
        metrics: { kneeFlexion: { value: 170, confidence: 0.9 } }, // too high
      }),
      bench,
    );
    const cues = selectCues(rep, bench);
    const knee = [cues.primary, ...cues.secondary].find(
      (c) => c?.metric === "kneeFlexion",
    );
    expect(knee?.direction).toBe("high");
    expect(knee?.feedback).toBe(bench.targets.kneeFlexion!.feedback.tooHigh);
  });
});

describe("selectCues — degenerate inputs", () => {
  it("falls back to the metric name when the benchmark lacks the target", () => {
    const rep = scoreRep(
      makeShotAnalysis({
        metrics: { shootingElbowFlare: { value: 45, confidence: 0.9 } },
      }),
      bench,
    );
    const benchWithout = {
      ...bench,
      targets: Object.fromEntries(
        Object.entries(bench.targets).filter(
          ([k]) => k !== "shootingElbowFlare",
        ),
      ),
    } as typeof bench;
    const cues = selectCues(rep, benchWithout);
    expect(cues.primary?.metric).toBe("shootingElbowFlare");
    expect(cues.primary?.text).toBe("shootingElbowFlare");
    expect(cues.primary?.feedback).toBeNull();
  });
});

describe("selectCues — incorrect-direction feedback", () => {
  it("uses the incorrect feedback string for categorical misses", () => {
    const rep = scoreRep(
      makeShotAnalysis({
        metrics: { guideHandPosition: { value: "under", confidence: 0.9 } },
      }),
      bench,
    );
    const cue = [
      selectCues(rep, bench).primary,
      ...selectCues(rep, bench).secondary,
    ].find((c) => c?.metric === "guideHandPosition");
    expect(cue?.direction).toBe("incorrect");
    expect(cue?.feedback).toBe(
      bench.targets.guideHandPosition!.feedback.incorrect,
    );
  });
});

describe("selectCues — missing feedback strings", () => {
  it("returns null feedback when the target has no string for the direction", () => {
    const noFeedback = {
      ...bench,
      targets: {
        ...bench.targets,
        kneeFlexion: {
          ...bench.targets.kneeFlexion!,
          feedback: {},
        },
      },
    } as typeof bench;
    const low = scoreRep(
      makeShotAnalysis({
        metrics: { kneeFlexion: { value: 20, confidence: 0.9 } },
      }),
      noFeedback,
    );
    expect(
      selectCues(low, noFeedback, "kneeFlexion").primary?.feedback,
    ).toBeNull();

    const high = scoreRep(
      makeShotAnalysis({
        metrics: { kneeFlexion: { value: 170, confidence: 0.9 } },
      }),
      noFeedback,
    );
    expect(
      selectCues(high, noFeedback, "kneeFlexion").primary?.feedback,
    ).toBeNull();
  });
});
