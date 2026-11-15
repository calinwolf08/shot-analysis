import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import type { FlatMetric } from "basketball-shot-analysis";
import ScoreCard from "../ScoreCard.svelte";
import { scoreDeviation, type LiveTargets } from "../deviation";

const targets: LiveTargets = {
  version: 1,
  metrics: {
    "setPoint.elbow_flare": {
      section: "structure",
      phase: "setPoint",
      label: "Elbow flare",
      unit: "",
      ideal: 90,
      sd: 5,
      passMin: 85,
      passMax: 95,
      rampSd: 5,
      direction: { low: "low", high: "high" },
      scored: true,
    },
    "seq.legs_extend__release": {
      section: "sequencing",
      phase: null,
      label: "Legs extend → Release",
      unit: "Δt",
      ideal: -0.1,
      sd: 0.05,
      passMin: -0.2,
      passMax: -0.04,
      rampSd: 0.05,
      direction: { low: "early", high: "late" },
      scored: true,
    },
  },
};

const flat = (id: string, value: number): FlatMetric => ({
  id,
  value,
  reliable: true,
  frames: [1],
});

describe("ScoreCard", () => {
  it("renders the overall score, both sections, and a per-metric row", () => {
    // elbow_flare 100 → high, out of band (score 3); seq in band (score 1).
    const card = scoreDeviation(
      [
        flat("setPoint.elbow_flare", 100),
        flat("seq.legs_extend__release", -0.1),
      ],
      targets,
    );
    render(ScoreCard, { card });

    expect(screen.getByTestId("sc-overall").textContent).toContain("2.0"); // mean(3,1)
    expect(screen.getByTestId("sc-section-structure").textContent).toContain(
      "Structure",
    );
    expect(screen.getByTestId("sc-section-sequencing").textContent).toContain(
      "Sequencing",
    );

    const row = screen.getByTestId("sc-metric-setPoint.elbow_flare");
    expect(row.textContent).toContain("Elbow flare");
    expect(row.textContent).toContain("high by 5"); // 100 - passMax 95
  });

  it("surfaces the worst metrics as chips", () => {
    const card = scoreDeviation([flat("setPoint.elbow_flare", 110)], targets);
    expect(screen.queryByTestId).toBeDefined();
    render(ScoreCard, { card });
    expect(screen.getByTestId("sc-worst").textContent).toContain("Elbow flare");
  });
});
