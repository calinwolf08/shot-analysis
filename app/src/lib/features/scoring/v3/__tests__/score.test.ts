import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EVENT_PAD_AFTER,
  EVENT_PAD_BEFORE,
  buildTargetsV3,
  computeShotMetricsV3,
  type LiveTargetsV3,
  type MetricV3,
  type ShotMetricsV3,
  type SignalFrame,
  type TargetV3,
} from "basketball-shot-analysis";
import {
  describeResult,
  displayScore,
  issueText,
  feedbackV3,
  formatAmount,
  scoreBand,
  scoreShotV3,
  targetText,
} from "../score";

function target(over: Partial<TargetV3>): TargetV3 {
  return {
    phase: "load",
    kind: "structure",
    unit: "deg",
    label: "Knee bend",
    wording: {
      low: { phrase: "too deep", cue: "Bend less" },
      high: { phrase: "too shallow", cue: "Bend more" },
    },
    scored: true,
    ideal: 130,
    sd: 5,
    passMin: 125,
    passMax: 135,
    rampSd: 5,
    n: 7,
    lowResolution: false,
    ...over,
  };
}
const metric = (value: number, over: Partial<MetricV3> = {}): MetricV3 => ({
  value,
  frames: [10],
  reliable: true,
  kind: "structure",
  phase: "load",
  unit: "deg",
  ...over,
});
const targets = (m: Record<string, TargetV3>): LiveTargetsV3 => ({
  version: 2,
  catalog: "v3",
  builtFrom: "t",
  shootingHand: "right",
  shots: 7,
  generatedAt: "x",
  notes: [],
  metrics: m,
});

describe("0–10+ scale", () => {
  const t = targets({ "load.knee_depth": target({}) });
  const score = (v: number) => scoreShotV3({ "load.knee_depth": metric(v) }, t);

  it("0 inside the band, +1 per spread beyond the edge", () => {
    expect(score(130).phases[0]!.metrics[0]!.score).toBe(0);
    expect(score(135).phases[0]!.metrics[0]!.score).toBe(0);
    expect(score(140).phases[0]!.metrics[0]!.score).toBeCloseTo(1, 9); // 5° past = 1 sd
    expect(score(115).phases[0]!.metrics[0]!.score).toBeCloseTo(2, 9);
  });

  it("a negligible excess (< 5% of a spread) counts as on target", () => {
    const r = score(135.1).phases[0]!.metrics[0]!;
    expect(r.score).toBe(0);
    expect(r.direction).toBeNull();
    expect(describeResult(r)).toBe("Knee bend: on target");
  });

  it("stores the real score but displays a 10+ cap", () => {
    const r = score(200).phases[0]!.metrics[0]!;
    expect(r.score).toBeCloseTo(13, 9);
    expect(displayScore(r.score)).toBe("10+");
    // Whole numbers, rounded UP: anything off target shows at least 1.
    expect(displayScore(9.94)).toBe("10+");
    expect(displayScore(8.2)).toBe("9");
    expect(displayScore(2)).toBe("2");
    expect(displayScore(0.06)).toBe("1");
    expect(displayScore(0)).toBe("0");
    expect(displayScore(null)).toBe("–");
  });

  it("bands on the shown whole numbers: 0 good, 1–3 close, 4–6 off, 7+ way off", () => {
    expect([0, 0.2, 3, 3.1, 6, 6.5, 12].map(scoreBand)).toEqual([
      "good",
      "fair",
      "fair",
      "off",
      "off",
      "far",
      "far",
    ]);
  });

  it("issueText: label, phrase and the whole score — no measured amount", () => {
    const tt = targets({
      "load.head_vs_spine": target({ label: "Head position" }),
    });
    const card = scoreShotV3({ "load.head_vs_spine": metric(115) }, tt);
    const r = card.phases[0]!.metrics[0]!;
    expect(r.score).toBeGreaterThan(1);
    expect(issueText(r)).toBe(
      `Head position: ${r.phrase} by ${Math.ceil(r.score!)}`,
    );
    expect(issueText(r)).not.toMatch(/°|%/);
  });

  it("phase = mean of its metrics; overall = mean of phases", () => {
    const tt = targets({
      "load.knee_depth": target({}),
      "load.spine_angle": target({ label: "Torso lean" }),
      "release.wrist_snap": target({ phase: "release", label: "Wrist snap" }),
    });
    const card = scoreShotV3(
      {
        "load.knee_depth": metric(140), // 1
        "load.spine_angle": metric(145), // 2
        "release.wrist_snap": metric(150, { phase: "release" }), // 3
      },
      tt,
    );
    expect(card.phases.map((p) => p.phase)).toEqual([
      "load",
      "rise",
      "setPoint",
      "release",
    ]);
    expect(card.phases[0]!.score).toBeCloseTo(1.5, 9);
    expect(card.phases[1]!.score).toBeNull();
    expect(card.overall).toBeCloseTo((1.5 + 3) / 2, 9);
  });

  it("withholds the overall when too little was measured", () => {
    const tt = targets({
      "load.knee_depth": target({}),
      "load.spine_angle": target({}),
      "load.ball_drop": target({}),
    });
    const card = scoreShotV3({ "load.knee_depth": metric(130) }, tt);
    expect(card.belowCoverageGate).toBe(true);
    expect(card.overall).toBeNull();
  });
});

describe("feedback", () => {
  const tt = targets({
    "load.knee_depth": target({
      wording: {
        low: { phrase: "too deep", cue: "Bend less" },
        high: { phrase: "too shallow", cue: "Bend your knees more" },
      },
    }),
    "load.spine_angle": target({
      label: "Torso lean",
      wording: {
        low: { phrase: "too upright", cue: "Lean forward" },
        high: { phrase: "x", cue: "y" },
      },
    }),
    "setPoint.elbow_angle": target({
      phase: "setPoint",
      label: "Elbow at set point",
      wording: {
        low: { phrase: "elbow too bent", cue: "Open the elbow" },
        high: { phrase: "x", cue: "y" },
      },
    }),
    "release.wrist_snap": target({
      phase: "release",
      label: "Wrist snap",
      wording: {
        low: { phrase: "not enough snap", cue: "Snap the wrist" },
        high: { phrase: "x", cue: "y" },
      },
    }),
  });
  const card = scoreShotV3(
    {
      "load.knee_depth": metric(150), // 3 (worst)
      "load.spine_angle": metric(120), // 1
      "setPoint.elbow_angle": metric(115, { phase: "setPoint" }), // 2
      "release.wrist_snap": metric(110, { phase: "release" }), // 3
    },
    tt,
  );

  it("feeds back the 3 worst, in phase order, cues grouped and named by phase", () => {
    const fb = feedbackV3(card);
    expect(fb.items.map((r) => r.id)).toEqual([
      "load.knee_depth",
      "setPoint.elbow_angle",
      "release.wrist_snap",
    ]);
    expect(fb.spoken).toBe(
      "Load: Bend your knees more. Set point: Open the elbow. Release: Snap the wrist.",
    );
  });

  it("describes measurements in plain language with the target", () => {
    const r = card.phases[0]!.metrics.find((m) => m.id === "load.knee_depth")!;
    expect(describeResult(r)).toBe("Knee bend: too shallow by 15°");
    expect(targetText(r)).toBe("target 125 to 135°");
  });

  it("formats each unit for people", () => {
    expect(formatAmount("phase", 0.153, "load")).toBe("15% of the load");
    expect(formatAmount("torso", -0.08, "setPoint")).toBe(
      "8% of your torso length",
    );
    expect(formatAmount("s", 0.123, "release")).toBe("0.12 s");
  });

  it("focus limits feedback to the chosen areas", () => {
    const fb = feedbackV3(card, { focus: (id) => id.startsWith("release.") });
    expect(fb.items.map((r) => r.id)).toEqual(["release.wrist_snap"]);
  });
});

describe("Curry, leave-one-out (fairness of the targets)", () => {
  const root = join(process.cwd(), "..", "test-data", "stephen-curry-1");
  const P = JSON.parse(readFileSync(join(root, "poses.json"), "utf8"));
  const L = JSON.parse(readFileSync(join(root, "labels.json"), "utf8"));
  const shots: ShotMetricsV3[] = L.shots.map(
    (s: { startFrame: number; endFrame: number }) =>
      computeShotMetricsV3(
        P.frames.slice(
          s.startFrame - EVENT_PAD_BEFORE,
          s.endFrame + EVENT_PAD_AFTER + 1,
        ) as SignalFrame[],
        { aspect: P.width / P.height, shootingHand: "right" },
      ),
  );

  it("each Curry shot scores low against targets built from the other six", () => {
    const overalls = shots.map((s, i) => {
      const others = shots.filter((_, j) => j !== i);
      const t = buildTargetsV3(others, {
        builtFrom: "loo",
        shootingHand: "right",
      });
      return scoreShotV3(s.metrics, t).overall!;
    });
    const mean = overalls.reduce((a, b) => a + b, 0) / overalls.length;
    console.info(
      "Curry leave-one-out overall scores:",
      overalls.map((o) => o.toFixed(2)).join(", "),
      "mean",
      mean.toFixed(2),
    );
    expect(mean).toBeLessThan(1.5);
    expect(Math.max(...overalls)).toBeLessThan(3);
  });
});
