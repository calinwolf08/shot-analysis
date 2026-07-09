/**
 * Rule-based 2-week plan generator. Pure and deterministic: same focus
 * areas + drill catalog + level always produce the same block.
 *
 * Design-doc rules: alternate drill / live-practice sessions, hardest
 * focus front-loaded, every 2nd live session adds a free-shooting block
 * (transfer measurement), block always ends with a re-assessment item.
 */
import type { MetricName } from "$lib/features/benchmarks";
import type { IssueGroupId } from "$lib/features/diagnosis";
import type { Drill } from "$lib/features/drills";
import type { PlayerLevel } from "$lib/shared/db/repos";
import type { PlanItemType } from "./repo/plan-repo";

export const PLAN_CONFIG = {
  blockDays: 14,
  defaultSessionsPerWeek: 4,
  focusedLiveReps: 20,
  freeShootingReps: 10,
  /** Severity drop (0–1) that rotates a focus area out on re-assessment. */
  improvementThreshold: 0.15,
} as const;

/** Focus area input, ranked hardest-first (severity descending). */
export interface PlanFocusArea {
  issueGroup: IssueGroupId;
  displayName: string;
  severity: number;
  /** Contributing metrics, most severe first. */
  focusMetrics: MetricName[];
}

export interface PlanSpecItem {
  dayIndex: number;
  position: number;
  type: PlanItemType;
  drillId: string | null;
  focusMetric: string | null;
  targetReps: number | null;
}

export interface PlanSpec {
  /** Focus snapshot persisted with the plan (adaptation input later). */
  focus: PlanFocusArea[];
  items: PlanSpecItem[];
}

export interface GeneratePlanInput {
  focusAreas: PlanFocusArea[];
  drills: Drill[];
  playerLevel: PlayerLevel;
  sessionsPerWeek?: number;
}

const LEVEL_MAX_DIFFICULTY: Record<PlayerLevel, 1 | 2 | 3> = {
  youth: 1,
  "high-school": 2,
  advanced: 3,
};

export function generatePlan(input: GeneratePlanInput): PlanSpec {
  const sessionsPerWeek =
    input.sessionsPerWeek ?? PLAN_CONFIG.defaultSessionsPerWeek;
  const totalSessions = Math.max(2, Math.round(sessionsPerWeek * 2));
  const focus = [...input.focusAreas].sort(
    (a, b) =>
      b.severity - a.severity || a.issueGroup.localeCompare(b.issueGroup),
  );
  const maxDifficulty = LEVEL_MAX_DIFFICULTY[input.playerLevel];

  const dayFor = (session: number) =>
    Math.round((session * (PLAN_CONFIG.blockDays - 1)) / (totalSessions - 1));

  const items: PlanSpecItem[] = [];
  // Per-focus visit counter so repeat drill sessions rotate through the
  // best-matching drills instead of repeating the top one.
  const drillVisits = new Map<IssueGroupId, number>();
  let liveCount = 0;

  for (let s = 0; s < totalSessions - 1; s++) {
    const day = dayFor(s);
    const area = focus.length > 0 ? focus[s % focus.length]! : null;
    const isDrillSession = s % 2 === 0;

    if (isDrillSession) {
      const visit = area ? (drillVisits.get(area.issueGroup) ?? 0) : s;
      if (area) drillVisits.set(area.issueGroup, visit + 1);
      const ranked = rankDrills(input.drills, area, maxDifficulty);
      const drill = ranked.length > 0 ? ranked[visit % ranked.length]! : null;
      items.push({
        dayIndex: day,
        position: 0,
        type: "drill",
        drillId: drill?.id ?? null,
        focusMetric: area?.focusMetrics[0] ?? null,
        targetReps: null,
      });
    } else {
      liveCount++;
      items.push({
        dayIndex: day,
        position: 0,
        type: "live_practice",
        drillId: null,
        focusMetric: area?.focusMetrics[0] ?? null,
        targetReps: PLAN_CONFIG.focusedLiveReps,
      });
      // Every 2nd live session: free-shooting block to measure transfer.
      if (liveCount % 2 === 0) {
        items.push({
          dayIndex: day,
          position: 1,
          type: "live_practice",
          drillId: null,
          focusMetric: null,
          targetReps: PLAN_CONFIG.freeShootingReps,
        });
      }
    }
  }

  items.push({
    dayIndex: PLAN_CONFIG.blockDays - 1,
    position: 0,
    type: "reassessment",
    drillId: null,
    focusMetric: null,
    targetReps: null,
  });

  return { focus, items };
}

/** Deterministic drill ranking for a focus (mirrors DrillService order). */
function rankDrills(
  drills: Drill[],
  area: PlanFocusArea | null,
  maxDifficulty: 1 | 2 | 3,
): Drill[] {
  const wantMetrics = new Set<string>(area?.focusMetrics ?? []);
  const wantGroup = area?.issueGroup ?? null;
  return drills
    .filter((d) => d.difficulty <= maxDifficulty)
    .map((d) => ({
      drill: d,
      metricOverlap: d.focusMetrics.filter((m) => wantMetrics.has(m)).length,
      groupOverlap: wantGroup && d.issueGroups.includes(wantGroup) ? 1 : 0,
    }))
    .filter((x) => area === null || x.metricOverlap > 0 || x.groupOverlap > 0)
    .sort(
      (a, b) =>
        b.metricOverlap - a.metricOverlap ||
        b.groupOverlap - a.groupOverlap ||
        a.drill.difficulty - b.drill.difficulty ||
        a.drill.slug.localeCompare(b.drill.slug),
    )
    .map((x) => x.drill);
}

/**
 * Adaptation rule on re-assessment: focus areas that improved by at least
 * the threshold (severity drop vs the previous plan's snapshot) rotate
 * out; regressed or new issues stay in. Never returns an empty list while
 * `current` has entries — the hardest current area is always kept.
 */
export function adaptFocusAreas(
  current: PlanFocusArea[],
  previous: PlanFocusArea[] | null,
  threshold: number = PLAN_CONFIG.improvementThreshold,
): PlanFocusArea[] {
  if (!previous || previous.length === 0 || current.length === 0) {
    return current;
  }
  const prevSeverity = new Map(previous.map((p) => [p.issueGroup, p.severity]));
  const kept = current.filter((area) => {
    const before = prevSeverity.get(area.issueGroup);
    if (before === undefined) return true; // new issue rotates in
    return before - area.severity < threshold; // insufficient improvement
  });
  if (kept.length > 0) return kept;
  const hardest = [...current].sort((a, b) => b.severity - a.severity)[0]!;
  return [hardest];
}
