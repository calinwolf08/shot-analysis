import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import DeltaStrip from "../components/results/DeltaStrip.svelte";
import type { FocusDelta, ScoreDelta } from "../components/results/deltas";

const scoreDeltas: ScoreDelta[] = [
  { key: "overall", label: "Overall", delta: 7.4 },
  { key: "form", label: "Form", delta: -3.2 },
  { key: "consistency", label: "Consistency", delta: null },
  { key: "efficiency", label: "Efficiency", delta: 0 },
];

const focusDeltas: FocusDelta[] = [
  {
    issueGroup: "alignment",
    displayName: "Alignment",
    delta: -0.3,
    resolved: false,
  },
  {
    issueGroup: "rhythm",
    displayName: "Rhythm",
    delta: 0.1,
    resolved: false,
  },
  {
    issueGroup: "guide-hand",
    displayName: "Guide hand",
    delta: -0.5,
    resolved: true,
  },
];

describe("DeltaStrip", () => {
  it("renders ▲/▼ sub-score chips and skips null deltas", () => {
    render(DeltaStrip, { scoreDeltas, focusDeltas });

    const overall = screen.getByTestId("delta-overall");
    expect(overall.textContent).toContain("▲");
    expect(overall.textContent).toContain("7");
    expect(overall.className).toContain("up");

    const form = screen.getByTestId("delta-form");
    expect(form.textContent).toContain("▼");
    expect(form.className).toContain("down");

    expect(screen.queryByTestId("delta-consistency")).toBeNull();
    expect(screen.getByTestId("delta-efficiency").textContent).toContain("▲");
  });

  it("labels focus areas improved / needs work / resolved", () => {
    render(DeltaStrip, { scoreDeltas, focusDeltas });
    expect(screen.getByTestId("delta-focus-alignment").textContent).toContain(
      "improved",
    );
    expect(screen.getByTestId("delta-focus-rhythm").textContent).toContain(
      "needs work",
    );
    expect(screen.getByTestId("delta-focus-guide-hand").textContent).toContain(
      "resolved",
    );
  });
});
