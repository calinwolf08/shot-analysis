import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { computeShotMetricsV3 } from "./metrics";
import { EVENT_PAD_AFTER, EVENT_PAD_BEFORE } from "./labeled";
import { buildTargetsV3, effectiveBand } from "./targets";
import { DEFAULT_WORDING } from "./wording";
import type { SignalFrame } from "./signals";

const root = path.resolve(__dirname, "../../../test-data/stephen-curry-1");
const P = JSON.parse(fs.readFileSync(path.join(root, "poses.json"), "utf8"));
const L = JSON.parse(fs.readFileSync(path.join(root, "labels.json"), "utf8"));
const shots = L.shots.map((s: { startFrame: number; endFrame: number }) =>
  computeShotMetricsV3(
    P.frames.slice(s.startFrame - EVENT_PAD_BEFORE, s.endFrame + EVENT_PAD_AFTER + 1) as SignalFrame[],
    { aspect: P.width / P.height, shootingHand: "right" },
  ),
);
const meta = { builtFrom: "test", shootingHand: "right" as const, generatedAt: "x" };

describe("buildTargetsV3", () => {
  const t = buildTargetsV3(shots, meta);

  it("has a target for every catalog metric", () => {
    expect(Object.keys(t.metrics).sort()).toEqual(Object.keys(shots[0]!.metrics).sort());
  });

  it("band = observed range; mean inside; details never scored", () => {
    for (const [id, m] of Object.entries(t.metrics)) {
      if (m.n === 0) continue;
      expect(m.passMin, id).toBeLessThanOrEqual(m.ideal);
      expect(m.passMax, id).toBeGreaterThanOrEqual(m.ideal);
      if (m.kind === "detail") expect(m.scored, id).toBe(false);
      if (m.n < 3) expect(m.scored, id).toBe(false);
    }
  });

  it("keeps hand edits (label, wording, override) across rebuilds", () => {
    const edited = {
      metrics: {
        ...t.metrics,
        "load.knee_depth": {
          ...t.metrics["load.knee_depth"]!,
          label: "Knee dip",
          wording: { low: { phrase: "x", cue: "y" }, high: { phrase: "deep enough?", cue: "Sit lower" } },
          override: { passMin: 100, passMax: 150 },
        },
      },
    };
    const rebuilt = buildTargetsV3(shots, meta, edited);
    const k = rebuilt.metrics["load.knee_depth"]!;
    expect(k.label).toBe("Knee dip");
    expect(k.wording.high.cue).toBe("Sit lower");
    expect(effectiveBand(k)).toEqual({ passMin: 100, passMax: 150, scored: true });
    expect(k.ideal).toBeCloseTo(t.metrics["load.knee_depth"]!.ideal, 9); // stats refreshed
  });
});

describe("wording", () => {
  it("every metric has a label, phrases and cues for both directions", () => {
    for (const id of Object.keys(shots[0]!.metrics)) {
      const w = DEFAULT_WORDING[id];
      expect(w, id).toBeDefined();
      for (const d of [w!.low, w!.high]) {
        expect(d.phrase.length, id).toBeGreaterThan(2);
        expect(d.cue.length, id).toBeGreaterThan(0);
      }
      if (!id.startsWith("detail.")) {
        expect(w!.low.cue, id).not.toBe("—");
        expect(w!.high.cue, id).not.toBe("—");
      }
    }
  });
});
