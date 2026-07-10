import { describe, expect, it } from "vitest";
import type { FocusAreaRow } from "$lib/features/diagnosis";
import type { ScoreRecord } from "$lib/shared/db/repos";
import {
  computeFocusDeltas,
  computeScoreDeltas,
} from "../components/results/deltas";

function scoreRecord(overrides: Partial<ScoreRecord>): ScoreRecord {
  return {
    id: "sc",
    scope: "session",
    refId: "s",
    benchmarkId: "b",
    scoringVersion: 1,
    formScore: 60,
    consistencyScore: 55,
    efficiencyScore: 50,
    overallScore: 58,
    breakdown: {},
    createdAt: 0,
    ...overrides,
  };
}

function focusRow(
  group: string,
  severity: number,
  rank: number,
  surfaced = true,
): FocusAreaRow {
  return {
    id: `${group}-${rank}`,
    sessionId: "s",
    rank,
    issueGroup: group,
    severity,
    metrics: { displayName: group.toUpperCase(), surfaced },
    createdAt: 0,
  };
}

describe("computeScoreDeltas", () => {
  it("computes signed deltas per sub-score, null when a side is missing", () => {
    const deltas = computeScoreDeltas(
      scoreRecord({ overallScore: 66, consistencyScore: null }),
      scoreRecord({ overallScore: 58, formScore: 64 }),
    );
    const byKey = Object.fromEntries(deltas.map((d) => [d.key, d.delta]));
    expect(byKey.overall).toBe(8);
    expect(byKey.form).toBe(-4); // 60 vs 64
    expect(byKey.consistency).toBeNull();
    expect(byKey.efficiency).toBe(0);
  });
});

describe("computeFocusDeltas", () => {
  it("tracks each previously surfaced area in rank order", () => {
    const previous = [
      focusRow("rhythm", 0.6, 2),
      focusRow("alignment", 0.8, 1),
      focusRow("posture", 0.3, 5, false), // never surfaced → ignored
    ];
    const current = [
      focusRow("alignment", 0.5, 2), // improved
      focusRow("rhythm", 0.7, 1), // regressed
    ];
    const deltas = computeFocusDeltas(current, previous);
    expect(deltas.map((d) => d.issueGroup)).toEqual(["alignment", "rhythm"]);
    expect(deltas[0]!.delta).toBeCloseTo(-0.3, 5);
    expect(deltas[0]!.resolved).toBe(false);
    expect(deltas[0]!.displayName).toBe("ALIGNMENT");
    expect(deltas[1]!.delta).toBeCloseTo(0.1, 5);
  });

  it("marks vanished areas as resolved", () => {
    const previous = [focusRow("guide-hand", 0.5, 1)];
    const deltas = computeFocusDeltas([], previous);
    expect(deltas[0]!.resolved).toBe(true);
    expect(deltas[0]!.delta).toBeCloseTo(-0.5, 5);
  });
});
