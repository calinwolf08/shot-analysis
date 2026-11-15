import { describe, expect, it } from "vitest";
import type { MetricDeviation } from "$lib/features/scoring";
import { buildWorstReadback, phraseFor } from "../readback";

function dev(over: Partial<MetricDeviation>): MetricDeviation {
  return {
    id: "setPoint.elbow_flare",
    label: "Elbow flare",
    section: "structure",
    phase: "setPoint",
    value: 100,
    ideal: 90,
    passMin: 85,
    passMax: 95,
    unit: "",
    score: 3,
    normDev: 2,
    inBand: false,
    direction: "high",
    magnitude: 5,
    scored: true,
    ...over,
  };
}

describe("phraseFor", () => {
  it("renders metric, direction and native-unit magnitude", () => {
    expect(
      phraseFor(
        dev({ label: "Elbow flare", direction: "high", magnitude: 6.2 }),
      ),
    ).toBe("Elbow flare high by 6");
  });

  it("converts a Δt timing gap to whole frames when duration is known", () => {
    const m = dev({
      label: "Set point",
      direction: "low",
      unit: "Δt",
      magnitude: 0.067,
    });
    expect(phraseFor(m, 30)).toBe("Set point low by 2"); // round(0.067*30)
  });

  it("keeps small fractional magnitudes legible", () => {
    expect(
      phraseFor(dev({ label: "Depth", direction: "low", magnitude: 0.03 })),
    ).toBe("Depth low by 0.03");
  });

  it("drops the magnitude when there is no direction", () => {
    expect(
      phraseFor(dev({ label: "Elbow flare", direction: null, magnitude: 0 })),
    ).toBe("Elbow flare");
  });
});

describe("buildWorstReadback", () => {
  it("joins the worst metrics into one terse phrase", () => {
    const worst = [
      dev({
        label: "Set point",
        direction: "low",
        unit: "Δt",
        magnitude: 0.067,
      }),
      dev({ label: "Elbow flare", direction: "high", magnitude: 6 }),
    ];
    expect(buildWorstReadback(worst, { durationFrames: 30 })).toBe(
      "Set point low by 2, Elbow flare high by 6",
    );
  });

  it("caps at `max` metrics", () => {
    const worst = Array.from({ length: 8 }, (_, i) =>
      dev({ label: `M${i}`, direction: "high", magnitude: 2 }),
    );
    expect(buildWorstReadback(worst, { max: 3 }).split(", ")).toHaveLength(3);
  });

  it("returns an empty string when nothing is off-target", () => {
    expect(buildWorstReadback([])).toBe("");
  });
});
