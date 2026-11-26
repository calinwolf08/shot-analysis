import { describe, expect, it } from "vitest";
import type {
  CheckResult,
  KeyframeScorecard,
} from "$lib/features/scoring/keyframes";
import {
  REANALYSIS_UNAVAILABLE,
  dayLabel,
  groupByDay,
  shotIssue,
  timeLabel,
} from "../shot-list";

const at = (y: number, mo: number, d: number, h = 12, mi = 0) =>
  new Date(y, mo - 1, d, h, mi).getTime();
const NOW = at(2026, 11, 17, 15, 30);

describe("dayLabel", () => {
  it("names today and yesterday by local calendar day", () => {
    expect(dayLabel(at(2026, 11, 17, 0, 5), NOW)).toBe("Today");
    expect(dayLabel(at(2026, 11, 16, 23, 59), NOW)).toBe("Yesterday");
  });
  it("uses a short date otherwise, with the year only when different", () => {
    expect(dayLabel(at(2026, 11, 14), NOW)).toMatch(/Nov/);
    expect(dayLabel(at(2026, 11, 14), NOW)).not.toMatch(/2026/);
    expect(dayLabel(at(2025, 11, 14), NOW)).toMatch(/2025/);
  });
});

describe("timeLabel", () => {
  it("formats a clock time", () => {
    expect(timeLabel(at(2026, 11, 17, 16, 12))).toMatch(/4:12|16:12/);
  });
});

describe("groupByDay", () => {
  it("groups newest-first rows under day headers, preserving order", () => {
    const rows = [
      { id: "a", createdAt: at(2026, 11, 17, 15) },
      { id: "b", createdAt: at(2026, 11, 17, 9) },
      { id: "c", createdAt: at(2026, 11, 16, 20) },
      { id: "d", createdAt: at(2026, 11, 2, 8) },
    ];
    const groups = groupByDay(rows, NOW);
    expect(groups.map((g) => g.label.replace(/\d+/, "#"))).toEqual([
      "Today",
      "Yesterday",
      expect.stringMatching(/Nov/),
    ]);
    expect(groups.map((g) => g.rows.map((r) => r.id))).toEqual([
      ["a", "b"],
      ["c"],
      ["d"],
    ]);
  });
});

describe("shotIssue", () => {
  const card = (
    overall: number | null,
    worst: Partial<CheckResult>[],
  ): KeyframeScorecard =>
    ({
      overall,
      worst: worst as CheckResult[],
    }) as unknown as KeyframeScorecard;

  it("names the worst check with its phase, in the screen's words", () => {
    const worst = {
      id: "rise.knee_bend",
      keyframe: "rise",
      phase: "rise",
      name: "Knee bend",
      phrase: "Knees too bent",
      direction: "low",
      score: 4.2,
      value: 132,
    } as Partial<CheckResult>;
    expect(shotIssue(card(3.2, [worst]))).toBe("Rise: Knees too bent by 5");
  });
  it("says on target when nothing is off", () => {
    expect(shotIssue(card(1, []))).toBe("On target");
  });
  it("is null when too little was measured to score it", () => {
    expect(shotIssue(card(null, []))).toBeNull();
  });
  it("flags an old shot that can't be re-analyzed", () => {
    expect(shotIssue(null)).toBe(REANALYSIS_UNAVAILABLE);
  });
});
