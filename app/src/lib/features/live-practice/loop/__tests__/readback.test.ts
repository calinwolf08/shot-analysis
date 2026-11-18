import { describe, expect, it } from "vitest";
import type { MetricDeviation } from "$lib/features/scoring";
import { buildWorstReadback, feedbackItems, phraseFor } from "../readback";

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
  it("reads the 3 worst, in phase order, each group named by its phase", () => {
    // Worst-first input spanning phases out of order.
    const worst = [
      dev({
        label: "Elbow flare",
        phase: "setPoint",
        direction: "high",
        magnitude: 6,
      }),
      dev({
        label: "Knee bend",
        phase: "load",
        direction: "low",
        magnitude: 12,
      }),
      dev({ label: "Hips", phase: "load", direction: "high", magnitude: 0.2 }),
      dev({
        label: "Wrist snap",
        phase: "release",
        direction: "low",
        magnitude: 9,
      }),
    ];
    expect(buildWorstReadback(worst)).toBe(
      "Load: Knee bend low by 12, Hips high by 0.2. Set point: Elbow flare high by 6.",
    );
  });

  it("converts timing gaps to frames inside the phase groups", () => {
    const worst = [
      dev({
        label: "Set point",
        phase: "rise",
        direction: "low",
        unit: "Δt",
        magnitude: 0.067,
      }),
    ];
    expect(buildWorstReadback(worst, { durationFrames: 30 })).toBe(
      "Rise: Set point low by 2.",
    );
  });

  it("caps at `max` metrics", () => {
    const worst = Array.from({ length: 8 }, (_, i) =>
      dev({ label: `M${i}`, direction: "high", magnitude: 2 }),
    );
    expect(buildWorstReadback(worst, { max: 2 })).toBe(
      "Set point: M0 high by 2, M1 high by 2.",
    );
  });

  it("returns an empty string when nothing is off-target", () => {
    expect(buildWorstReadback([])).toBe("");
  });
});

describe("feedbackItems / inPhaseOrder", () => {
  it("keeps the worst N, then orders them load → release", () => {
    const items = feedbackItems(
      [
        dev({ id: "a", phase: "release" }),
        dev({ id: "b", phase: "load" }),
        dev({ id: "c", phase: "setPoint" }),
        dev({ id: "d", phase: "rise" }), // 4th worst: dropped
      ],
      3,
    );
    expect(items.map((m) => m.id)).toEqual(["b", "c", "a"]);
  });
});
