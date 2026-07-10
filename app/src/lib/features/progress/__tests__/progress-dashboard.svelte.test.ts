import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { builtInBenchmarks } from "$lib/features/benchmarks";
import ProgressDashboard from "../components/ProgressDashboard.svelte";
import type {
  MetricTrendPoint,
  ProgressTotals,
  ScoreHistoryPoint,
} from "../service";

const benchmark = builtInBenchmarks()[0]!;

const totals: ProgressTotals = {
  sessions: 4,
  assessments: 2,
  repsAnalyzed: 17,
  streakDays: 3,
};

function point(
  i: number,
  type: ScoreHistoryPoint["type"],
  overall: number | null,
): ScoreHistoryPoint {
  return {
    sessionId: `s-${i}`,
    type,
    completedAt: 1_700_000_000_000 + i * 86_400_000,
    overallScore: overall,
    formScore: 60 + i,
    consistencyScore: overall === null ? null : 50 + i,
    efficiencyScore: 40 + i,
  };
}

const history = [
  point(0, "assessment", 62),
  point(1, "live_practice", null),
  point(2, "live_practice", 68),
  point(3, "assessment", 71),
];

function renderDashboard(loadTrend = vi.fn().mockResolvedValue([])) {
  render(ProgressDashboard, {
    history,
    totals,
    benchmark,
    loadTrend,
    sessionHref: (p: ScoreHistoryPoint) => `/progress/session/${p.sessionId}`,
  });
  return loadTrend;
}

describe("ProgressDashboard", () => {
  it("shows totals, the score chart with assessment markers, and history", () => {
    renderDashboard();

    expect(screen.getByTestId("progress-streak").textContent).toBe("3");
    // Overall series drops the null live session → 3 points; markers on
    // the two assessments (chart indexes 0 and 2).
    expect(screen.getByTestId("progress-score-chart-point-2")).toBeTruthy();
    expect(screen.queryByTestId("progress-score-chart-point-3")).toBeNull();
    expect(screen.getByTestId("progress-score-chart-marker-0")).toBeTruthy();
    expect(screen.getByTestId("progress-score-chart-marker-2")).toBeTruthy();
    expect(screen.queryByTestId("progress-score-chart-marker-1")).toBeNull();

    // History is newest-first and links to the session detail.
    const rows = screen.getByTestId("progress-history");
    const links = rows.querySelectorAll("a");
    expect(links).toHaveLength(4);
    expect(links[0]!.getAttribute("href")).toBe("/progress/session/s-3");
    expect(links[0]!.textContent).toContain("Assessment");
    expect(links[1]!.textContent).toContain("Live practice");
  });

  it("switching sub-score re-plots (form has all 4 points)", async () => {
    renderDashboard();
    screen.getByTestId("progress-toggle-form").click();
    await vi.waitFor(() =>
      expect(screen.getByTestId("progress-score-chart-point-3")).toBeTruthy(),
    );
  });

  it("metric explorer loads a trend and draws the benchmark band", async () => {
    const trend: MetricTrendPoint[] = [
      { sessionId: "s-0", completedAt: 0, mean: 40, std: 2, n: 3 },
      { sessionId: "s-2", completedAt: 1, mean: 46, std: 1.5, n: 4 },
    ];
    const loadTrend = renderDashboard(vi.fn().mockResolvedValue(trend));

    const picker = screen.getByTestId<HTMLSelectElement>(
      "progress-metric-picker",
    );
    picker.value = "kneeFlexion";
    picker.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() =>
      expect(screen.getByTestId("progress-metric-chart")).toBeTruthy(),
    );
    expect(loadTrend).toHaveBeenCalledWith("kneeFlexion");
    expect(screen.getByTestId("progress-metric-chart-band")).toBeTruthy();
  });
});
