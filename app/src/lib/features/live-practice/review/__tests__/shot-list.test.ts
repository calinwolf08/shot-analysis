import { describe, expect, it } from "vitest";
import type { MetricResultV3, ScorecardV3 } from "$lib/features/scoring/v3";
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
    worst: Partial<MetricResultV3>[],
  ): ScorecardV3 =>
    ({
      overall,
      worst: worst as MetricResultV3[],
    }) as unknown as ScorecardV3;

  it("names the worst metric with its phase, in the short wording", () => {
    const w = {
      format: "{phrase} by {n}",
      metrics: {
        "load.knee_depth": { low: "Knees deep", high: "Knees shallow" },
      },
    };
    const worst = {
      id: "load.knee_depth",
      label: "Knee bend",
      phrase: "too shallow",
      phase: "load",
      direction: "high",
      score: 3.2,
      value: 150,
    } as Partial<MetricResultV3>;
    expect(shotIssue(card(3.2, [worst]), w)).toBe("Load: Knees shallow by 4");
    // Without configured wording: the scorecard text.
    expect(shotIssue(card(3.2, [worst]))).toBe(
      "Load: Knee bend: too shallow by 4",
    );
  });
  it("says on target when nothing is off", () => {
    expect(shotIssue(card(1, []))).toBe("On target");
  });
  it("is null when too little was measured to score it", () => {
    expect(shotIssue(card(null, []))).toBeNull();
  });
  it("flags a pre-v3 shot that can't be re-analyzed", () => {
    expect(shotIssue(null)).toBe(REANALYSIS_UNAVAILABLE);
  });
});
