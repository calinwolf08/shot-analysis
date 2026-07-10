import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { builtInBenchmarks, METRIC_NAMES } from "$lib/features/benchmarks";
import type { FocusAreaRow } from "$lib/features/diagnosis";
import { makeShotAnalysis } from "$lib/shared/testing/fixtures";
import type { ShotRecord } from "$lib/shared/db/repos";
import TopIssues from "../components/results/TopIssues.svelte";
import MetricsAccordion from "../components/results/MetricsAccordion.svelte";
import { summarizeMetrics } from "../components/results/metrics-summary";

const bench = builtInBenchmarks()[0]!;

function makeArea(
  rank: number,
  group: string,
  displayName: string,
  surfaced = true,
): FocusAreaRow {
  return {
    id: `fa-${rank}`,
    sessionId: "sess",
    rank,
    issueGroup: group,
    severity: 1 - rank * 0.1,
    metrics: {
      displayName,
      whyItMatters: "Because physics.",
      surfaced,
      metrics: [
        {
          metric: "shootingElbowFlare",
          displayName: "Elbow alignment",
          shortCue: "Tuck your elbow",
          feedback: "Your elbow drifts out.",
        },
      ],
    },
    createdAt: 0,
  };
}

describe("TopIssues", () => {
  it("renders surfaced areas in diagnosis rank order, max 3", () => {
    const areas = [
      makeArea(3, "posture", "Posture"),
      makeArea(1, "alignment", "Alignment"),
      makeArea(2, "rhythm", "Rhythm"),
      makeArea(4, "guide-hand", "Guide hand", false),
    ];
    render(TopIssues, { areas });

    const first = screen.getByTestId("top-issue-0");
    const second = screen.getByTestId("top-issue-1");
    const third = screen.getByTestId("top-issue-2");
    expect(first.textContent).toContain("Alignment");
    expect(first.textContent).toContain("#1");
    expect(second.textContent).toContain("Rhythm");
    expect(third.textContent).toContain("Posture");
    expect(screen.queryByTestId("top-issue-3")).toBeNull();
    expect(first.textContent).toContain("Why it matters");
    expect(first.textContent).toContain("Your elbow drifts out.");
  });
});

function shotRecord(
  metrics: Record<string, { value: number | string; confidence: number }>,
  index = 0,
): ShotRecord {
  return {
    id: `s-${index}`,
    sessionId: "sess",
    videoId: null,
    shotIndex: index,
    orientation: null,
    startFrame: 0,
    endFrame: 60,
    overallConfidence: 0.8,
    excluded: false,
    analysis: makeShotAnalysis({ metrics }),
    createdAt: 0,
  };
}

describe("MetricsAccordion + summarizeMetrics", () => {
  it("groups all 26 benchmark metrics under their categories", () => {
    const shots = [shotRecord({})];
    const byCategory = summarizeMetrics(shots, bench);

    const total = Object.values(byCategory).reduce(
      (s, rows) => s + rows.length,
      0,
    );
    expect(total).toBe(METRIC_NAMES.length);
    for (const [category, rows] of Object.entries(byCategory)) {
      for (const row of rows) {
        expect(bench.targets[row.metric]!.category).toBe(category);
      }
    }

    render(MetricsAccordion, { byCategory });
    for (const category of Object.keys(byCategory)) {
      expect(screen.getByTestId(`metrics-group-${category}`)).toBeTruthy();
    }
  });

  it("dims low-confidence rows with an excluded-from-score note", async () => {
    const shots = [
      shotRecord({
        kneeFlexion: { value: 45, confidence: 0.2 }, // below threshold
        shootingElbowAngle: { value: 90, confidence: 0.9 },
      }),
    ];
    const byCategory = summarizeMetrics(shots, bench);
    const knee = byCategory["lower-body"].find(
      (r) => r.metric === "kneeFlexion",
    )!;
    expect(knee.status).toBe("low-confidence");

    render(MetricsAccordion, { byCategory });
    // Open the lower-body group.
    const header = screen
      .getByTestId("metrics-group-lower-body")
      .querySelector("button")!;
    header.click();
    await Promise.resolve();
    const row = await screen.findByTestId("metric-row-kneeFlexion");
    expect(row.className).toContain("dimmed");
    expect(row.textContent).toContain("not scored");
  });

  it("computes σ across shots and pass/fail statuses", () => {
    const shots = [
      shotRecord({ shootingElbowAngle: { value: 88, confidence: 0.9 } }, 0),
      shotRecord({ shootingElbowAngle: { value: 92, confidence: 0.9 } }, 1),
    ];
    const byCategory = summarizeMetrics(shots, bench);
    const elbow = byCategory["shooting-arm"].find(
      (r) => r.metric === "shootingElbowAngle",
    )!;
    expect(elbow.status).toBe("pass");
    expect(elbow.valueText).toBe("90.0°");
    expect(elbow.std).toBeCloseTo(2, 5);
  });
});
