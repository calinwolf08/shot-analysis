/**
 * "Since last assessment" comparisons for the results screen: sub-score
 * deltas and per-focus-area severity movement vs the prior assessment.
 */
import type { FocusAreaRow } from "$lib/features/diagnosis";
import type { ScoreRecord } from "$lib/shared/db/repos";

export interface ScoreDelta {
  key: "overall" | "form" | "consistency" | "efficiency";
  label: string;
  /** current − previous; null when either side is missing. */
  delta: number | null;
}

export function computeScoreDeltas(
  current: ScoreRecord,
  previous: ScoreRecord,
): ScoreDelta[] {
  const pairs: [ScoreDelta["key"], string, keyof ScoreRecord][] = [
    ["overall", "Overall", "overallScore"],
    ["form", "Form", "formScore"],
    ["consistency", "Consistency", "consistencyScore"],
    ["efficiency", "Efficiency", "efficiencyScore"],
  ];
  return pairs.map(([key, label, field]) => {
    const now = current[field] as number | null;
    const before = previous[field] as number | null;
    return {
      key,
      label,
      delta: now !== null && before !== null ? now - before : null,
    };
  });
}

export interface FocusDelta {
  issueGroup: string;
  displayName: string;
  /** Severity change (current − previous); negative = improved. */
  delta: number;
  /** True when the issue no longer surfaces at all. */
  resolved: boolean;
}

interface StoredFocusPayload {
  displayName?: string;
  surfaced?: boolean;
}

/** One delta per previously surfaced focus area, in previous rank order. */
export function computeFocusDeltas(
  current: readonly FocusAreaRow[],
  previous: readonly FocusAreaRow[],
): FocusDelta[] {
  const surfaced = (row: FocusAreaRow) =>
    (row.metrics as StoredFocusPayload | null)?.surfaced === true;
  const currentByGroup = new Map(current.map((row) => [row.issueGroup, row]));

  return previous
    .filter(surfaced)
    .sort((a, b) => a.rank - b.rank)
    .map((prev) => {
      const now = currentByGroup.get(prev.issueGroup);
      const name =
        (prev.metrics as StoredFocusPayload | null)?.displayName ??
        prev.issueGroup;
      return {
        issueGroup: prev.issueGroup,
        displayName: name,
        delta: (now?.severity ?? 0) - prev.severity,
        resolved: now === undefined || !surfaced(now),
      };
    });
}
