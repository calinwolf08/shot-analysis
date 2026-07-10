import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import ScoreRing from "../ScoreRing.svelte";
import MetricChip from "../MetricChip.svelte";
import PlaceholderBadge from "../PlaceholderBadge.svelte";
import ProgressBar from "../ProgressBar.svelte";
import { scoreBand } from "../score-band";

describe("scoreBand", () => {
  it("maps the design color bands", () => {
    expect(scoreBand(0)).toBe("fail");
    expect(scoreBand(30)).toBe("fail");
    expect(scoreBand(49.9)).toBe("fail");
    expect(scoreBand(50)).toBe("warn");
    expect(scoreBand(60)).toBe("warn");
    expect(scoreBand(70)).toBe("good");
    expect(scoreBand(80)).toBe("good");
    expect(scoreBand(85)).toBe("elite");
    expect(scoreBand(95)).toBe("elite");
    expect(scoreBand(100)).toBe("elite");
    expect(scoreBand(null)).toBe("none");
  });
});

describe("ScoreRing", () => {
  const bands: [number, string][] = [
    [30, "fail"],
    [60, "warn"],
    [80, "good"],
    [95, "elite"],
  ];
  for (const [value, band] of bands) {
    it(`renders band "${band}" at ${value}`, () => {
      render(ScoreRing, { value });
      const ring = screen.getByTestId("score-ring");
      expect(ring.dataset.band).toBe(band);
      expect(ring.textContent).toContain(String(value));
    });
  }

  it("renders an em dash and no band when value is null", () => {
    render(ScoreRing, { value: null, label: "Overall" });
    const ring = screen.getByTestId("score-ring");
    expect(ring.dataset.band).toBe("none");
    expect(ring.textContent).toContain("–");
    expect(ring.textContent).toContain("Overall");
  });
});

describe("MetricChip", () => {
  for (const status of ["pass", "warning", "fail", "low-confidence"] as const) {
    it(`renders status ${status}`, () => {
      render(MetricChip, { status, label: "Elbow" });
      const chip = screen.getByTestId("metric-chip");
      expect(chip.dataset.status).toBe(status);
      expect(chip.textContent).toContain("Elbow");
    });
  }
});

describe("PlaceholderBadge", () => {
  it("renders when show is true", () => {
    render(PlaceholderBadge, { show: true });
    expect(screen.getByTestId("placeholder-badge").textContent).toContain(
      "Sample data",
    );
  });

  it("renders nothing when show is false", () => {
    render(PlaceholderBadge, { show: false });
    expect(screen.queryByTestId("placeholder-badge")).toBeNull();
  });
});

describe("ProgressBar", () => {
  it("clamps and exposes aria value", () => {
    render(ProgressBar, { value: 0.42, label: "Analyzing" });
    const bar = screen.getByRole("progressbar", { name: "Analyzing" });
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
  });

  it("clamps out-of-range values", () => {
    render(ProgressBar, { value: 7 });
    expect(
      screen.getByTestId("progress-bar").getAttribute("aria-valuenow"),
    ).toBe("100");
  });
});
