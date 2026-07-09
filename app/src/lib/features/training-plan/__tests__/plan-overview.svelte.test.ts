import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import PlanOverview from "../components/PlanOverview.svelte";
import type { PlanFocusArea } from "../generator";
import type { PlanItem } from "../repo/plan-repo";

const focus: PlanFocusArea[] = [
  {
    issueGroup: "alignment",
    displayName: "Alignment",
    severity: 0.8,
    focusMetrics: ["shootingElbowFlare"],
  },
];

function item(overrides: Partial<PlanItem>): PlanItem {
  return {
    id: "i-0",
    planId: "p-1",
    dayIndex: 0,
    position: 0,
    type: "drill",
    drillId: "drill-1",
    focusMetric: "shootingElbowFlare",
    targetReps: null,
    status: "pending",
    completedAt: null,
    ...overrides,
  };
}

const items: PlanItem[] = [
  item({ id: "i-0", dayIndex: 0, status: "done", completedAt: 123 }),
  item({
    id: "i-1",
    dayIndex: 2,
    type: "live_practice",
    drillId: null,
    targetReps: 20,
  }),
  item({
    id: "i-2",
    dayIndex: 13,
    type: "reassessment",
    drillId: null,
    focusMetric: null,
  }),
];

const drillTitles = { "drill-1": "Form Shooting — Close Range" };

describe("PlanOverview", () => {
  it("renders focus chips, session meta, and day states", () => {
    render(PlanOverview, {
      focus,
      items,
      drillTitles,
      onopen: () => {},
      onback: () => {},
    });

    expect(screen.getByTestId("plan-focus-chips").textContent).toContain(
      "Alignment",
    );
    expect(screen.getByText("2-week block, 3 sessions")).toBeTruthy();

    // Day 1 all done, day 3 is today, day 14 locked.
    expect(screen.getByTestId("plan-day-0").textContent).toContain("Done");
    expect(screen.getByTestId("plan-day-2").textContent).toContain("Today");
    expect(screen.getByTestId("plan-day-13").textContent).toContain("Locked");

    // Labels: completed drill by title, live by metric name, reassessment.
    expect(screen.getByTestId("plan-day-0").textContent).toContain(
      "Form Shooting — Close Range",
    );
    expect(screen.getByTestId("plan-day-2").textContent).toContain(
      "Live practice — Elbow alignment",
    );
    expect(screen.getByTestId("plan-day-13").textContent).toContain(
      "Re-assessment",
    );

    // Progress reflects 1 of 3 done.
    expect(
      screen.getByTestId("plan-progress").getAttribute("aria-valuenow"),
    ).toBe("33");
  });

  it("only today's items are startable; locked days are disabled", async () => {
    const onopen = vi.fn();
    render(PlanOverview, {
      focus,
      items,
      drillTitles,
      onopen,
      onback: () => {},
    });

    const todayBtn = screen.getByTestId<HTMLButtonElement>("plan-item-i-1");
    const lockedBtn = screen.getByTestId<HTMLButtonElement>("plan-item-i-2");
    expect(todayBtn.disabled).toBe(false);
    expect(lockedBtn.disabled).toBe(true);
    // Done items show a check, not a button.
    expect(screen.queryByTestId("plan-item-i-0")).toBeNull();

    todayBtn.click();
    await Promise.resolve();
    expect(onopen).toHaveBeenCalledTimes(1);
    expect(onopen.mock.calls[0]![0].id).toBe("i-1");
  });
});
