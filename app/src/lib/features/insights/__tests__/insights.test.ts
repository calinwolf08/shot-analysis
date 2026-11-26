import { describe, expect, it } from "vitest";
import type {
  CheckResult,
  KeyframeScorecard,
} from "$lib/features/scoring/keyframes";
import { summarizeInsights, windowStart, type ScoredShotAt } from "../insights";

function worst(id: string, score: number, phrase = "too high"): CheckResult {
  return {
    id,
    keyframe: "setPoint",
    phase: "setPoint",
    check: "elbow_bend",
    part: "elbow",
    name: id.split(".").at(-1) ?? id,
    label: id.split(".").at(-1) ?? id,
    unit: "deg",
    value: 0,
    note: null,
    scored: true,
    score,
    direction: "high",
    magnitude: 1,
    passMin: 0,
    passMax: 0,
    phrase,
    frame: null,
  };
}

function card(
  overall: number | null,
  worstList: CheckResult[],
): KeyframeScorecard {
  return {
    overall,
    keyframes: [],
    checks: worstList,
    worst: worstList,
    measuredFraction: 1,
    belowCoverageGate: false,
  };
}

const shot = (createdAt: number, c: KeyframeScorecard): ScoredShotAt => ({
  createdAt,
  scorecard: c,
});

describe("windowStart", () => {
  const now = Date.parse("2026-02-10T15:30:00Z");
  it("today is local midnight; 7d/30d subtract days; all is 0", () => {
    const today = windowStart("today", now);
    expect(today).toBeLessThanOrEqual(now);
    expect(now - today).toBeLessThan(86_400_000); // within a day
    expect(windowStart("7d", now)).toBe(now - 7 * 86_400_000);
    expect(windowStart("30d", now)).toBe(now - 30 * 86_400_000);
    expect(windowStart("all", now)).toBe(0);
  });
});

describe("summarizeInsights", () => {
  it("ranks recurring issues by frequency × severity, worst first", () => {
    // elbow: off in 3 shots (score 2 each) → rank 6
    // wrist: off in 1 shot  (score 5)       → rank 5
    const shots = [
      shot(
        1,
        card(3, [worst("setPoint.elbow", 2), worst("setPoint.wrist", 5)]),
      ),
      shot(2, card(3, [worst("setPoint.elbow", 2, "too low")])),
      shot(3, card(3, [worst("setPoint.elbow", 2, "too low")])),
    ];
    const s = summarizeInsights(shots, { window: "7d" });
    expect(s.shotCount).toBe(3);
    expect(s.issues[0]!.id).toBe("setPoint.elbow");
    expect(s.issues[0]!.occurrences).toBe(3);
    expect(s.issues[0]!.frequency).toBe(1);
    expect(s.issues[0]!.rank).toBe(6);
    expect(s.issues[0]!.avgScore).toBe(2);
    // The way it's usually off (2 of 3 shots).
    expect(s.issues[0]!.phrase).toBe("too low");
    expect(s.issues[0]!.phase).toBe("setPoint");
    expect(s.issues[1]!.id).toBe("setPoint.wrist");
    expect(s.issues[1]!.rank).toBe(5);
  });

  it("averages overall and builds a chronological trend", () => {
    const s = summarizeInsights(
      [shot(30, card(4, [])), shot(10, card(2, [])), shot(20, card(null, []))],
      { window: "all" },
    );
    expect(s.avgOverall).toBe(3); // mean(4,2) ignoring null
    expect(s.trend.map((p) => p.t)).toEqual([10, 20, 30]); // sorted asc
    expect(s.trend[1]!.overall).toBeNull();
  });

  it("caps issues at maxIssues and handles an empty window", () => {
    const many = [
      shot(
        1,
        card(
          5,
          Array.from({ length: 12 }, (_, i) => worst(`m.${i}`, 12 - i)),
        ),
      ),
    ];
    expect(
      summarizeInsights(many, { window: "all", maxIssues: 5 }).issues,
    ).toHaveLength(5);

    const empty = summarizeInsights([], { window: "today" });
    expect(empty.shotCount).toBe(0);
    expect(empty.avgOverall).toBeNull();
    expect(empty.issues).toEqual([]);
  });
});
