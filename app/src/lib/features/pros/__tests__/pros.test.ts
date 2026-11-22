import { describe, expect, it } from "vitest";
import type {
  LiveTargetsV3,
  ProProfiles,
  TargetV3,
} from "basketball-shot-analysis";
import type { ScorecardV3 } from "$lib/features/scoring/v3";
import {
  chooseTargets,
  closestPros,
  loadProProfiles,
  resetProProfilesCache,
  targetsForPro,
  userAverages,
} from "../pros";

const target = (over: Partial<TargetV3>): TargetV3 =>
  ({
    phase: "load",
    kind: "structure",
    unit: "deg",
    label: "Knee bend",
    wording: { low: { phrase: "", cue: "" }, high: { phrase: "", cue: "" } },
    scored: true,
    ideal: 125,
    sd: 4,
    passMin: 120,
    passMax: 130,
    rampSd: 4,
    n: 30,
    lowResolution: false,
    ...over,
  }) as TargetV3;

const pooled = {
  version: 2,
  catalog: "v3",
  builtFrom: "pros",
  shootingHand: "right",
  shots: 30,
  generatedAt: "",
  notes: [],
  metrics: {
    "load.knee_depth": target({}),
    "setPoint.wrist_vs_head": target({
      label: "Set point height",
      unit: "torso",
      ideal: 0.1,
      passMin: 0,
      passMax: 0.2,
      rampSd: 0.05,
      scored: false,
      style: true,
    }),
    "detail.x": target({ kind: "detail", scored: false }),
  },
} as unknown as LiveTargetsV3;

const profiles: ProProfiles = {
  version: 1,
  builtAt: "",
  metricsSchema: 4,
  pros: [
    {
      id: "curry",
      name: "Stephen Curry",
      shootingHand: "right",
      shots: 20,
      angles: [2, 18],
      metrics: {
        "load.knee_depth": { value: 132, spread: 2, n: 20 },
        "setPoint.wrist_vs_head": { value: 0.05, spread: 0.03, n: 20 },
      },
    },
    {
      id: "thompson",
      name: "Klay Thompson",
      shootingHand: "right",
      shots: 15,
      angles: [0, 12],
      metrics: {
        "load.knee_depth": { value: 118, spread: 3, n: 15 },
        "setPoint.wrist_vs_head": { value: 0.3, spread: 0.04, n: 15 },
      },
    },
  ],
};

describe("score against a pro", () => {
  it("re-centres each band on the pro, keeping the pooled width", () => {
    const t = targetsForPro(pooled, profiles.pros[0]!);
    const k = t.metrics["load.knee_depth"]!;
    expect(k.ideal).toBe(132);
    expect([k.passMin, k.passMax]).toEqual([127, 137]); // ±5 (pooled half-width)
    expect(k.rampSd).toBe(4);
  });

  it("uses the pro's spread when it's wider; scores style metrics; leaves details", () => {
    const wide = {
      ...profiles.pros[0]!,
      metrics: { "load.knee_depth": { value: 132, spread: 8, n: 20 } },
    };
    const k = targetsForPro(pooled, wide).metrics["load.knee_depth"]!;
    expect([k.passMin, k.passMax]).toEqual([124, 140]);
    const t = targetsForPro(pooled, profiles.pros[0]!);
    expect(t.metrics["setPoint.wrist_vs_head"]!.scored).toBe(true);
    expect(t.metrics["detail.x"]).toBe(pooled.metrics["detail.x"]);
  });

  it("an explicit 'not scored' override still wins; the band override doesn't", () => {
    const withOverride = {
      ...pooled,
      metrics: {
        ...pooled.metrics,
        "load.knee_depth": target({
          override: { passMin: 100, passMax: 110, scored: false },
        }),
      },
    } as LiveTargetsV3;
    const k = targetsForPro(withOverride, profiles.pros[0]!).metrics[
      "load.knee_depth"
    ]!;
    expect(k.scored).toBe(false);
    expect(k.override).toEqual({ scored: false });
    expect(k.passMin).toBe(127);
  });

  it("chooses pooled targets unless a known pro is picked", () => {
    expect(chooseTargets(pooled, profiles, null).pro).toBeNull();
    expect(chooseTargets(pooled, profiles, "nobody").targets).toBe(pooled);
    expect(chooseTargets(pooled, null, "curry").pro).toBeNull();
    expect(chooseTargets(pooled, profiles, "curry").pro?.name).toBe(
      "Stephen Curry",
    );
  });
});

const card = (knee: number, height: number) =>
  ({
    phases: [
      {
        metrics: [
          { id: "load.knee_depth", value: knee },
          { id: "setPoint.wrist_vs_head", value: height },
        ],
      },
    ],
    details: [{ id: "detail.x", value: null }],
  }) as unknown as ScorecardV3;

describe("closest pros", () => {
  it("averages the user's metrics over shots", () => {
    const u = userAverages([card(120, 0.3), card(124, 0.25)]);
    expect(u["load.knee_depth"]).toEqual({ mean: 122, n: 2 });
    expect(u["detail.x"]).toBeUndefined();
  });

  it("ranks the pro whose form is closest first, with highlights", () => {
    const u = userAverages([card(117, 0.31), card(119, 0.29), card(118, 0.3)]);
    const m = closestPros(u, profiles, pooled);
    expect(m.map((x) => x.pro.id)).toEqual(["thompson", "curry"]);
    expect(m[0]!.similarity).toBeGreaterThan(m[1]!.similarity);
    expect(m[0]!.compared).toBe(2);
    expect(m[0]!.best).toHaveLength(2);
  });

  it("needs a few shots per metric", () => {
    const u = userAverages([card(118, 0.3)]);
    expect(closestPros(u, profiles, pooled)).toEqual([]);
  });
});

describe("loading profiles", () => {
  it("null when the file is missing or empty", async () => {
    resetProProfilesCache();
    const missing = (async () =>
      new Response("", { status: 404 })) as typeof fetch;
    expect(await loadProProfiles(missing)).toBeNull();
    resetProProfilesCache();
    const empty = (async () =>
      new Response(JSON.stringify({ pros: [] }))) as typeof fetch;
    expect(await loadProProfiles(empty)).toBeNull();
    resetProProfilesCache();
    const ok = (async () =>
      new Response(JSON.stringify(profiles))) as typeof fetch;
    expect((await loadProProfiles(ok))?.pros).toHaveLength(2);
    resetProProfilesCache();
  });
});
