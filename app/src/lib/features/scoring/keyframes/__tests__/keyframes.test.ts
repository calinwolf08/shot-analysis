import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_CHECK_KEYS,
  type KeyframeTarget,
  type KeyframeTargets,
  type ShotKeyframes,
} from "basketball-shot-analysis";
import {
  FEEDBACK_PRESETS,
  activePreset,
  checkText,
  checksForAreas,
  displayScore,
  ensureKeyframes,
  feedbackChecks,
  filterLabel,
  hasKeyframes,
  headlineIssue,
  normalizeChecks,
  resolveEnabled,
  scoreShotKeyframes,
  severity,
  spokenReadback,
} from "..";
import type { ShotReviewPoses } from "$lib/shared/db/repos";

/** Every check: band 0..10, spread 1 (so a value of 10 + n scores n). */
function targets(): KeyframeTargets {
  const checks: Record<string, KeyframeTarget> = {};
  for (const id of ALL_CHECK_KEYS) {
    const [keyframe, check] = id.split(".") as [never, never];
    checks[id] = {
      keyframe,
      check,
      unit: "deg",
      scored: true,
      ideal: 5,
      sd: 1,
      passMin: 0,
      passMax: 10,
      rampSd: 1,
      n: 7,
    };
  }
  return {
    version: 1,
    catalog: "keyframes",
    builtFrom: "test",
    shootingHand: "right",
    shots: 7,
    generatedAt: "x",
    notes: [],
    checks,
  };
}

/** All checks in range, except the given values. */
function shot(values: Record<string, number> = {}): ShotKeyframes {
  const checks: Record<string, ShotKeyframes["checks"][string]> = {};
  for (const id of ALL_CHECK_KEYS) {
    const [keyframe, check] = id.split(".") as [never, never];
    checks[id] = {
      keyframe,
      check,
      unit: "deg",
      value: values[id] ?? 5,
      reliable: true,
      frame: 10,
    };
  }
  return {
    schemaVersion: 3,
    keyframes: { setup: 1, load: 2, rise: 3, setPoint: 4, release: 5 },
    checks,
    facing: 1,
    nearSide: "right",
    shootingSide: "right",
    xScale: 0.5625,
    lengths: { torso: 0.3, thigh: 0.2 },
    centreLine: true,
    points: {
      setup: null,
      load: null,
      rise: null,
      setPoint: null,
      release: null,
    },
  };
}

describe("keyframe scorecard", () => {
  it("scores every check, worst first, and averages keyframe → overall", () => {
    const card = scoreShotKeyframes(
      shot({
        "rise.knee_bend": -5,
        "release.hand_height": -1,
        "load.back": 12,
      }),
      targets(),
    );
    expect(card.checks).toHaveLength(33);
    expect(card.worst.map((r) => [r.id, r.score])).toEqual([
      ["rise.knee_bend", 5],
      ["load.back", 2],
      ["release.hand_height", 1],
    ]);
    const rise = card.keyframes.find((k) => k.keyframe === "rise")!;
    expect(rise.score).toBeCloseTo(5 / rise.checks.length, 6);
    expect(card.overall).toBeGreaterThan(0);
  });

  it("leaves turned-off checks out of everything", () => {
    const enabled = new Set(["rise.knee_bend", "rise.hips_over_knees"]);
    const card = scoreShotKeyframes(
      shot({ "rise.knee_bend": -5, "load.back": 12 }),
      targets(),
      enabled,
    );
    expect(card.checks.map((c) => c.id)).toEqual([
      "rise.knee_bend",
      "rise.hips_over_knees",
    ]);
    expect(card.worst.map((c) => c.id)).toEqual(["rise.knee_bend"]);
    expect(card.keyframes.find((k) => k.keyframe === "load")!.score).toBeNull();
    expect(card.overall).toBeCloseTo(2.5, 6);
  });

  it("withholds the overall when too little was measured", () => {
    const s = shot();
    const checks = Object.fromEntries(
      Object.entries(s.checks).map(([id, c]) => [
        id,
        { ...c, value: NaN, reliable: false },
      ]),
    );
    const card = scoreShotKeyframes({ checks }, targets());
    expect(card.overall).toBeNull();
    expect(card.belowCoverageGate).toBe(true);
  });

  it("writes '<part> too <direction> by N', and the headline with its phase", () => {
    const card = scoreShotKeyframes(
      shot({ "rise.knee_bend": -4.2, "release.hand_height": 11 }),
      targets(),
    );
    const byId = Object.fromEntries(card.checks.map((c) => [c.id, c]));
    expect(checkText(byId["rise.knee_bend"]!)).toBe("Knees too bent by 5");
    expect(checkText(byId["release.hand_height"]!)).toBe("Hands too high by 1");
    expect(checkText(byId["load.back"]!)).toBe("Back posture: in range");
    expect(headlineIssue(card)).toBe("Rise: Knees too bent by 5");
  });

  it("shows whole numbers rounded up, capped at 10+", () => {
    expect(displayScore(0)).toBe("0");
    expect(displayScore(0.04)).toBe("1");
    expect(displayScore(2.1)).toBe("3");
    expect(displayScore(3)).toBe("3");
    expect(displayScore(9.5)).toBe("10+");
    expect(displayScore(42)).toBe("10+");
    expect(displayScore(null)).toBe("–");
  });

  it("colors 0 green, 1–3 yellow, 4+ red", () => {
    expect(severity(0)).toBe("good");
    expect(severity(0.4)).toBe("warn");
    expect(severity(3)).toBe("warn");
    expect(severity(3.1)).toBe("bad");
    expect(severity(null)).toBeNull();
  });
});

describe("after-shot feedback", () => {
  const card = scoreShotKeyframes(
    shot({
      "rise.knee_bend": -5, // knees 5
      "setPoint.knee_bend": -4, // knees again: same body part, dropped
      "rise.hand_height": -3, // hands 3
      "rise.hips_over_knees": -3, // hips 3
      "release.hand_height": -1, // hands again
      "load.back": 11, // back 1 (4th body part: past the 3)
    }),
    targets(),
  );

  it("picks the worst three, one per body part, in shot order", () => {
    expect(feedbackChecks(card).map((c) => c.id)).toEqual([
      "rise.hand_height",
      "rise.knee_bend",
      "rise.hips_over_knees",
    ]);
  });

  it("says the screen's words, one lead-in per keyframe", () => {
    expect(spokenReadback(feedbackChecks(card))).toBe(
      "When the ball reaches set point: hands too low by 3, knees too bent by 5, hips too far back by 3.",
    );
    const two = scoreShotKeyframes(
      shot({ "setup.knee_bend": 12, "release.hand_height": -1 }),
      targets(),
    );
    expect(spokenReadback(feedbackChecks(two))).toBe(
      "At setup: knees too straight by 2. At release: hands too low by 1.",
    );
    expect(spokenReadback([])).toBe("");
  });
});

describe("feedback filter", () => {
  it("presets only name real checks; 'All feedback' is everything", () => {
    for (const p of FEEDBACK_PRESETS) {
      expect(normalizeChecks(p.checks), p.id).toEqual([...p.checks]);
      expect(p.checks.length, p.id).toBeGreaterThan(0);
    }
    expect(FEEDBACK_PRESETS[0]!.checks).toEqual(ALL_CHECK_KEYS);
  });

  it("names the selection by its preset, else Custom", () => {
    expect(filterLabel(null)).toBe("All feedback");
    const legs = FEEDBACK_PRESETS.find((p) => p.id === "legs")!;
    expect(activePreset(new Set(legs.checks))?.id).toBe("legs");
    expect(filterLabel(new Set(legs.checks.slice(1)))).toBe("Custom");
  });

  it("maps the old focus areas onto the checks at those keyframes", () => {
    const load = checksForAreas(["load"]);
    expect(
      load.every((id) => id.startsWith("setup.") || id.startsWith("load.")),
    ).toBe(true);
    expect(load).toContain("load.knee_bend");
    expect(checksForAreas(["rhythm"])).toEqual(["setPoint.hold"]);
    expect(checksForAreas(["elbow"])).toEqual(checksForAreas(["set-point"])); // legacy id
    expect(checksForAreas([])).toEqual([]);
  });

  it("prefers the saved filter, then the old areas, else everything", () => {
    expect(resolveEnabled(["rise.knee_bend", "nope"], ["load"])).toEqual(
      new Set(["rise.knee_bend"]),
    );
    expect(resolveEnabled(null, ["release"])).toEqual(
      new Set(checksForAreas(["release"])),
    );
    expect(resolveEnabled(null, [])).toBeNull();
    expect(resolveEnabled([], ["load"])).toEqual(new Set());
  });
});

describe("stored shots", () => {
  const root = join(
    __dirname,
    "../../../../../../../test-data/stephen-curry-1",
  );
  const P = JSON.parse(readFileSync(join(root, "poses.json"), "utf8")) as {
    width: number;
    height: number;
    fps?: number;
    frames: {
      frameIndex: number;
      timestamp: number;
      landmarks: { x: number; y: number; visibility: number }[] | null;
    }[];
  };
  const poses: ShotReviewPoses = {
    fps: 30,
    width: P.width,
    height: P.height,
    frames: P.frames.slice(130, 185).map((f, i) => ({
      frameIndex: i,
      t: f.timestamp,
      landmarks: f.landmarks ?? [],
    })),
  };

  it("computes keyframe checks from the pose track once, then keeps them", () => {
    const first = ensureKeyframes({} as never, poses, "right")!;
    expect(first.recomputed).toBe(true);
    expect(hasKeyframes(first.analysis)).toBe(true);
    expect(Object.keys(first.analysis.keyframes!.checks)).toHaveLength(33);
    const again = ensureKeyframes(first.analysis, poses, "right")!;
    expect(again.recomputed).toBe(false);
    expect(ensureKeyframes({} as never, null, "right")).toBeNull();
  });
});
