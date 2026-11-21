import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LiveTargetsV3 } from "basketball-shot-analysis";
import {
  EMPTY_FEEDBACK_WORDING,
  feedbackReadback,
  feedbackText,
  loadFeedbackWording,
  parseFeedbackWording,
} from "../feedback-wording";
import type { MetricResultV3 } from "../score";

const file = JSON.parse(
  readFileSync(
    join(process.cwd(), "static", "config", "feedback-wording.json"),
    "utf8",
  ),
);
const targets = JSON.parse(
  readFileSync(
    join(process.cwd(), "static", "reference", "live-targets-v3.json"),
    "utf8",
  ),
) as LiveTargetsV3;

function r(over: Partial<MetricResultV3>): MetricResultV3 {
  return {
    id: "load.spine_angle",
    phase: "load",
    kind: "structure",
    label: "Torso lean",
    unit: "deg",
    value: 30,
    note: null,
    scored: true,
    score: 2.2,
    direction: "high",
    magnitude: 10,
    passMin: -15,
    passMax: -7,
    ideal: -10,
    phrase: "leaning too far forward",
    cue: "Stay more upright",
    frames: [],
    ...over,
  };
}

describe("feedback wording file", () => {
  it("is valid and covers both directions of every scored metric", () => {
    const { wording, warnings } = parseFeedbackWording(file);
    expect(warnings).toEqual([]);
    expect(wording.format).toBe("{phrase} by {n}");
    const scored = Object.entries(targets.metrics)
      .filter(([, t]) => t.scored)
      .map(([id]) => id);
    const missing = scored.filter(
      (id) => !wording.metrics[id]?.low || !wording.metrics[id]?.high,
    );
    expect(missing).toEqual([]);
  });
});

describe("feedback text", () => {
  const { wording } = parseFeedbackWording(file);

  it("body part + direction of the fault + whole score (rounded up)", () => {
    expect(feedbackText(r({}), wording)).toBe("Spine forward by 3");
    expect(feedbackText(r({ direction: "low", score: 1 }), wording)).toBe(
      "Spine back by 1",
    );
    expect(feedbackText(r({ score: 14 }), wording)).toBe(
      "Spine forward by 10+",
    );
  });

  it("falls back to the scorecard wording when a metric isn't configured", () => {
    expect(feedbackText(r({}), EMPTY_FEEDBACK_WORDING)).toBe(
      "Torso lean: leaning too far forward by 3",
    );
  });

  it("speaks items grouped by phase; unconfigured items use their cue", () => {
    const items = [
      r({}),
      r({ id: "load.knee_depth", direction: "low", score: 3.5 }),
      r({ id: "setPoint.x", phase: "setPoint", cue: "Raise your set point" }),
    ];
    expect(feedbackReadback(items, wording)).toBe(
      "Load: Spine forward by 3. Knees deep by 4. Set point: Raise your set point.",
    );
  });

  it("honours a custom format", () => {
    const w = { ...wording, format: "{phrase}, {n}" };
    expect(feedbackText(r({}), w)).toBe("Spine forward, 3");
  });
});

describe("parse / load", () => {
  it("rejects a bad file with warnings and falls back", () => {
    const bad = parseFeedbackWording({
      format: "no placeholder",
      metrics: { "load.x": { low: "" } },
    });
    expect(bad.wording).toEqual(EMPTY_FEEDBACK_WORDING);
    expect(bad.warnings.length).toBeGreaterThan(0);
  });

  it("missing format → the default", () => {
    const ok = parseFeedbackWording({
      metrics: { "load.x": { low: "A", high: "B" } },
    });
    expect(ok.wording.format).toBe("{phrase} by {n}");
  });

  it("network errors never throw", async () => {
    const res = await loadFeedbackWording((() =>
      Promise.reject(new Error("offline"))) as typeof fetch);
    expect(res.wording).toEqual(EMPTY_FEEDBACK_WORDING);
    expect(res.warnings[0]).toMatch(/unreadable/);
  });
});
