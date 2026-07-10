import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import BarChart from "../charts/BarChart.svelte";
import LineChart from "../charts/LineChart.svelte";
import BandChart from "../charts/BandChart.svelte";

describe("BarChart", () => {
  it("renders one band-colored bar per value, nulls as empty slots", () => {
    render(BarChart, { values: [80, 40, null], max: 100, height: 100 });

    const chart = screen.getByTestId("bar-chart");
    expect(chart.querySelectorAll("rect")).toHaveLength(3);

    const tall = screen.getByTestId("bar-chart-bar-0");
    const short = screen.getByTestId("bar-chart-bar-1");
    const empty = screen.getByTestId("bar-chart-bar-2");
    expect(Number(tall.getAttribute("height"))).toBeGreaterThan(
      Number(short.getAttribute("height")),
    );
    expect(Number(empty.getAttribute("height"))).toBe(0);
    expect(tall.getAttribute("fill")).toBe("var(--sc-success)"); // 80 = good
    expect(short.getAttribute("fill")).toBe("var(--sc-fail)"); // 40 = fail
  });

  it("reports bar clicks and highlights a selection", async () => {
    const onbarclick = vi.fn();
    render(BarChart, { values: [10, 20, 30], highlight: 1, onbarclick });

    screen
      .getByTestId("bar-chart-bar-2")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(onbarclick).toHaveBeenCalledWith(2);
    expect(screen.getByTestId("bar-chart-bar-1").getAttribute("stroke")).toBe(
      "var(--sc-text)",
    );
    expect(screen.getByTestId("bar-chart-bar-0").getAttribute("opacity")).toBe(
      "0.55",
    );
  });
});

describe("LineChart", () => {
  it("renders a polyline through evenly spaced points", () => {
    render(LineChart, { values: [0, 50, 100], min: 0, max: 100, height: 100 });

    const line = screen.getByTestId("line-chart-line");
    const pts = line
      .getAttribute("points")!
      .split(" ")
      .map((p) => p.split(",").map(Number));
    expect(pts).toHaveLength(3);
    expect(pts[0]![0]).toBeCloseTo(0, 1);
    expect(pts[1]![0]).toBeCloseTo(50, 1);
    expect(pts[2]![0]).toBeCloseTo(100, 1);
    // Higher value → smaller y (screen coordinates).
    expect(pts[2]![1]!).toBeLessThan(pts[0]![1]!);
    expect(screen.getByTestId("line-chart-point-1")).toBeTruthy();
  });

  it("draws a lone point without a line", () => {
    render(LineChart, { values: [42] });
    expect(screen.queryByTestId("line-chart-line")).toBeNull();
    expect(screen.getByTestId("line-chart-point-0")).toBeTruthy();
  });
});

describe("BandChart", () => {
  it("draws the benchmark band behind the series", () => {
    render(BandChart, {
      values: [40, 50, 60],
      band: { min: 45, max: 55 },
      height: 100,
    });

    const band = screen.getByTestId("band-chart-band");
    expect(Number(band.getAttribute("height"))).toBeGreaterThan(0);
    expect(screen.getByTestId("band-chart-series-line")).toBeTruthy();
  });
});
