import { describe, expect, it } from "vitest";
import drillsJson from "$lib/features/drills/data/drills.json";
import { parseDrillFile } from "$lib/features/drills";
import {
  adaptFocusAreas,
  generatePlan,
  PLAN_CONFIG,
  type PlanFocusArea,
} from "../generator";

const catalog = parseDrillFile(drillsJson).drills;

const FOCUS: PlanFocusArea[] = [
  {
    issueGroup: "alignment",
    displayName: "Alignment",
    severity: 0.8,
    focusMetrics: ["shootingElbowFlare", "shoulderAlignment"],
  },
  {
    issueGroup: "rhythm",
    displayName: "Rhythm",
    severity: 0.6,
    focusMetrics: ["ballLegSync", "legRiseStart"],
  },
  {
    issueGroup: "guide-hand",
    displayName: "Guide hand",
    severity: 0.5,
    focusMetrics: ["guideHandPosition"],
  },
];

function makePlan(overrides = {}) {
  return generatePlan({
    focusAreas: FOCUS,
    drills: catalog,
    playerLevel: "high-school",
    ...overrides,
  });
}

describe("generatePlan invariants", () => {
  it("ends with exactly one reassessment item, on the last day", () => {
    const { items } = makePlan();
    const reassess = items.filter((i) => i.type === "reassessment");
    expect(reassess).toHaveLength(1);
    expect(items.at(-1)!.type).toBe("reassessment");
    expect(items.at(-1)!.dayIndex).toBe(PLAN_CONFIG.blockDays - 1);
    const maxDay = Math.max(...items.map((i) => i.dayIndex));
    expect(items.at(-1)!.dayIndex).toBe(maxDay);
  });

  it("gives every focus area at least 2 items", () => {
    const { items } = makePlan();
    for (const f of FOCUS) {
      // Both drill and focused-live items carry the focus area's top metric.
      const count = items.filter(
        (i) => i.focusMetric === f.focusMetrics[0],
      ).length;
      expect(
        count,
        `focus ${f.issueGroup} under-served`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("never assigns drills above the player's difficulty cap", () => {
    const drillsById = new Map(catalog.map((d) => [d.id, d]));
    for (const [level, cap] of [
      ["youth", 1],
      ["high-school", 2],
      ["advanced", 3],
    ] as const) {
      const { items } = makePlan({ playerLevel: level });
      for (const item of items) {
        if (item.type !== "drill" || !item.drillId) continue;
        expect(drillsById.get(item.drillId)!.difficulty).toBeLessThanOrEqual(
          cap,
        );
      }
    }
  });

  it("alternates drill and live-practice sessions, hardest focus first", () => {
    const { items, focus } = makePlan();
    // Focus snapshot is severity-sorted (hardest first).
    expect(focus[0]!.issueGroup).toBe("alignment");

    const primaries = items.filter(
      (i) => i.position === 0 && i.type !== "reassessment",
    );
    for (let s = 0; s < primaries.length; s++) {
      expect(primaries[s]!.type).toBe(s % 2 === 0 ? "drill" : "live_practice");
    }
    // Session 0 (drill) targets the hardest focus area's top metric.
    expect(primaries[0]!.focusMetric).toBe("shootingElbowFlare");
  });

  it("adds a free-shooting block to every 2nd live session", () => {
    const { items } = makePlan();
    const freeBlocks = items.filter(
      (i) => i.type === "live_practice" && i.focusMetric === null,
    );
    const liveSessions = items.filter(
      (i) => i.type === "live_practice" && i.position === 0,
    );
    expect(freeBlocks.length).toBe(Math.floor(liveSessions.length / 2));
    for (const block of freeBlocks) {
      expect(block.position).toBe(1);
      expect(block.targetReps).toBe(PLAN_CONFIG.freeShootingReps);
      // Shares the day with a focused live session.
      expect(liveSessions.some((l) => l.dayIndex === block.dayIndex)).toBe(
        true,
      );
    }
  });

  it("is deterministic and keeps days within the 2-week block, nondecreasing", () => {
    const a = makePlan();
    const b = makePlan();
    expect(a).toEqual(b);
    let prev = -1;
    for (const item of a.items) {
      expect(item.dayIndex).toBeGreaterThanOrEqual(0);
      expect(item.dayIndex).toBeLessThan(PLAN_CONFIG.blockDays);
      expect(item.dayIndex).toBeGreaterThanOrEqual(prev);
      prev = item.dayIndex;
    }
  });

  it("rotates through different drills on repeat visits to a focus", () => {
    // Single focus → every drill session serves it; drills should vary.
    const { items } = makePlan({ focusAreas: [FOCUS[0]!] });
    const drillIds = items
      .filter((i) => i.type === "drill")
      .map((i) => i.drillId);
    expect(drillIds.length).toBeGreaterThanOrEqual(2);
    expect(new Set(drillIds).size).toBeGreaterThan(1);
  });

  it("handles an empty focus list (free-shooting biased block)", () => {
    const { items, focus } = makePlan({ focusAreas: [] });
    expect(focus).toEqual([]);
    expect(items.at(-1)!.type).toBe("reassessment");
    for (const item of items) {
      if (item.type === "live_practice") expect(item.focusMetric).toBeNull();
    }
  });

  it("respects sessionsPerWeek", () => {
    const three = makePlan({ sessionsPerWeek: 3 });
    const primaries = three.items.filter((i) => i.position === 0);
    expect(primaries).toHaveLength(6); // 3/wk × 2 weeks, incl. reassessment
  });
});

describe("adaptFocusAreas", () => {
  const previous = FOCUS;

  it("rotates out areas that improved by at least the threshold", () => {
    const current: PlanFocusArea[] = [
      { ...FOCUS[0]!, severity: 0.8 - PLAN_CONFIG.improvementThreshold },
      { ...FOCUS[1]!, severity: 0.58 }, // improved, under threshold
    ];
    const adapted = adaptFocusAreas(current, previous);
    expect(adapted.map((a) => a.issueGroup)).toEqual(["rhythm"]);
  });

  it("keeps new and regressed issues", () => {
    const current: PlanFocusArea[] = [
      { ...FOCUS[0]!, severity: 0.9 }, // regressed
      {
        issueGroup: "posture",
        displayName: "Posture",
        severity: 0.4,
        focusMetrics: ["backPosture"],
      }, // new
    ];
    const adapted = adaptFocusAreas(current, previous);
    expect(adapted.map((a) => a.issueGroup)).toEqual(["alignment", "posture"]);
  });

  it("never returns empty while current has areas", () => {
    const current: PlanFocusArea[] = [
      { ...FOCUS[0]!, severity: 0.1 },
      { ...FOCUS[1]!, severity: 0.05 },
    ];
    const adapted = adaptFocusAreas(current, previous);
    expect(adapted).toHaveLength(1);
    expect(adapted[0]!.issueGroup).toBe("alignment"); // hardest current
  });

  it("passes current through with no previous plan", () => {
    expect(adaptFocusAreas(FOCUS, null)).toEqual(FOCUS);
    expect(adaptFocusAreas(FOCUS, [])).toEqual(FOCUS);
  });
});
