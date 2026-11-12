import { describe, it, expect } from "vitest";
import type { FlatMetric } from "basketball-shot-analysis";
import {
  scoreDeviation,
  scoreMetricDeviation,
  type LiveTarget,
  type LiveTargets,
} from "../deviation";

// --- fixtures ---------------------------------------------------------------

function structureTarget(over: Partial<LiveTarget> = {}): LiveTarget {
  return {
    section: "structure",
    phase: "setPoint",
    label: "Elbow flare",
    unit: "deg",
    ideal: 90,
    sd: 5,
    passMin: 85,
    passMax: 95,
    rampSd: 5,
    direction: { low: "low", high: "high" },
    scored: true,
    ...over,
  };
}

function seqTarget(over: Partial<LiveTarget> = {}): LiveTarget {
  return {
    section: "sequencing",
    phase: null,
    label: "Legs extend → Release",
    unit: "Δt",
    ideal: -0.1,
    sd: 0.05,
    passMin: -0.2,
    passMax: -0.04,
    rampSd: 0.05,
    direction: { low: "early", high: "late" },
    scored: true,
    ...over,
  };
}

const flat = (id: string, value: number, reliable = true): FlatMetric => ({
  id,
  value,
  reliable,
  frames: [1],
});

// --- per-metric -------------------------------------------------------------

describe("scoreMetricDeviation", () => {
  it("scores a value inside the band as a perfect 1, no direction", () => {
    const d = scoreMetricDeviation("setPoint.elbow_flare", 90, structureTarget());
    expect(d.inBand).toBe(true);
    expect(d.score).toBe(1);
    expect(d.direction).toBeNull();
    expect(d.magnitude).toBe(0);
  });

  it("flags a value below the band as 'low' with edge-distance magnitude", () => {
    // value 80: passMin 85 → magnitude 5; normDev = |80-90|/5 = 2 → score 3
    const d = scoreMetricDeviation("setPoint.elbow_flare", 80, structureTarget());
    expect(d.inBand).toBe(false);
    expect(d.direction).toBe("low");
    expect(d.magnitude).toBe(5);
    expect(d.score).toBe(3);
  });

  it("flags a value above the band as 'high'", () => {
    const d = scoreMetricDeviation("setPoint.elbow_flare", 100, structureTarget());
    expect(d.direction).toBe("high");
    expect(d.magnitude).toBe(5); // 100 - passMax 95
    expect(d.score).toBe(3); // 1 + |100-90|/5
  });

  it("clamps the score at 10 for far-out values", () => {
    const d = scoreMetricDeviation("setPoint.elbow_flare", 200, structureTarget());
    expect(d.score).toBe(10);
    expect(d.normDev).toBe(22); // |200-90|/5
  });

  it("uses the sequencing direction vocabulary (early/late)", () => {
    const low = scoreMetricDeviation("seq.legs_extend__release", -0.3, seqTarget());
    expect(low.direction).toBe("early"); // below passMin
    const high = scoreMetricDeviation("seq.legs_extend__release", 0.0, seqTarget());
    expect(high.direction).toBe("late"); // above passMax
  });

  it("never divides by zero when rampSd is degenerate", () => {
    const d = scoreMetricDeviation(
      "gather.ankles",
      0.5,
      structureTarget({ ideal: 0, passMin: 0, passMax: 0, rampSd: 0 }),
    );
    expect(Number.isFinite(d.score)).toBe(true);
    expect(Number.isFinite(d.normDev)).toBe(true);
  });
});

// --- shot scoring -----------------------------------------------------------

describe("scoreDeviation", () => {
  const targets: LiveTargets = {
    version: 1,
    metrics: {
      "setPoint.elbow_flare": structureTarget(),
      "setPoint.elbow_angle": structureTarget({
        label: "Elbow angle",
        ideal: 140,
        passMin: 135,
        passMax: 150,
        rampSd: 6,
      }),
      "load.depth_drop": structureTarget({
        phase: "load",
        label: "Depth drop",
        ideal: 0.03,
        passMin: 0.01,
        passMax: 0.09,
        rampSd: 0.02,
      }),
      "seq.legs_extend__release": seqTarget(),
      "gather.ankles": structureTarget({
        phase: "gather",
        label: "Ankles",
        ideal: 0,
        passMin: 0,
        passMax: 0,
        rampSd: 0.000001,
        scored: false, // reported-only
      }),
    },
  };

  it("groups into Structure and Sequencing sections, each by phase", () => {
    const card = scoreDeviation(
      [
        flat("setPoint.elbow_flare", 90),
        flat("setPoint.elbow_angle", 142),
        flat("load.depth_drop", 0.03),
        flat("seq.legs_extend__release", -0.1),
        flat("gather.ankles", 0),
      ],
      targets,
    );

    const structure = card.sections.find((s) => s.section === "structure")!;
    const sequencing = card.sections.find((s) => s.section === "sequencing")!;
    expect(structure.label).toBe("Structure");
    // structure phases present: gather, load, setPoint (in phase order)
    expect(structure.phases.map((p) => p.phase)).toEqual([
      "gather",
      "load",
      "setPoint",
    ]);
    // the sequencing gap is grouped under its from-event's phase (release)
    expect(sequencing.phases.map((p) => p.phase)).toEqual(["release"]);
  });

  it("averages scored metrics into group/section/overall (equal section weight)", () => {
    // elbow_flare 80 → 3, elbow_angle 142 → 1 (in band), setPoint group = 2
    // depth_drop in band → 1; structure = mean(3,1,1) = 1.666… → 1.7
    // seq in band → 1; sequencing = 1
    // overall = mean(1.7, 1) = 1.35 → 1.4
    const card = scoreDeviation(
      [
        flat("setPoint.elbow_flare", 80),
        flat("setPoint.elbow_angle", 142),
        flat("load.depth_drop", 0.03),
        flat("seq.legs_extend__release", -0.1),
      ],
      targets,
    );
    const structure = card.sections.find((s) => s.section === "structure")!;
    const setPoint = structure.phases.find((p) => p.phase === "setPoint")!;
    expect(setPoint.score).toBe(2);
    expect(structure.score).toBe(1.7);
    const sequencing = card.sections.find((s) => s.section === "sequencing")!;
    expect(sequencing.score).toBe(1);
    expect(card.overall).toBe(1.4);
  });

  it("excludes reported-only metrics from aggregates and worst", () => {
    const card = scoreDeviation(
      [flat("gather.ankles", 0.5), flat("setPoint.elbow_flare", 90)],
      targets,
    );
    // ankles is present in `all` but scored:false
    const ankles = card.all.find((m) => m.id === "gather.ankles")!;
    expect(ankles.scored).toBe(false);
    expect(card.worst.some((m) => m.id === "gather.ankles")).toBe(false);
    // gather group has no scored metric → null group score
    const gather = card.sections
      .find((s) => s.section === "structure")!
      .phases.find((p) => p.phase === "gather")!;
    expect(gather.score).toBeNull();
  });

  it("ranks worst off-target metrics by normDev, capped at maxWorst", () => {
    const card = scoreDeviation(
      [
        flat("setPoint.elbow_flare", 70), // normDev |70-90|/5 = 4
        flat("setPoint.elbow_angle", 170), // normDev |170-140|/6 = 5
        flat("load.depth_drop", 0.03), // in band
        flat("seq.legs_extend__release", -0.1), // in band
      ],
      targets,
      { maxWorst: 1 },
    );
    expect(card.worst).toHaveLength(1);
    expect(card.worst[0]!.id).toBe("setPoint.elbow_angle");
  });

  it("ignores measured metrics that have no target", () => {
    const card = scoreDeviation([flat("some.unknown_metric", 42)], targets);
    expect(card.all).toHaveLength(0);
    expect(card.overall).toBeNull();
  });

  it("computes coverage over scored targets and flags the gate", () => {
    // 4 scored targets (ankles is reported-only); measure only 1 → 0.25
    const card = scoreDeviation([flat("setPoint.elbow_flare", 90)], targets);
    expect(card.scoredTargetCount).toBe(4);
    expect(card.measuredCount).toBe(1);
    expect(card.measuredFraction).toBe(0.25);
    expect(card.belowCoverageGate).toBe(true);
  });

  it("skips unreliable readings", () => {
    const card = scoreDeviation(
      [flat("setPoint.elbow_flare", 90, false)],
      targets,
    );
    expect(card.all).toHaveLength(0);
    expect(card.measuredCount).toBe(0);
  });
});
