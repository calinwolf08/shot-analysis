import { makeShotAnalysis } from "$lib/shared/testing/fixtures";
import { beforeEach, describe, expect, it } from "vitest";
import {
  TEST_USER_ID,
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";

let services: TestServices;
/** Real, owned refs (the server repos only score what the user owns). */
let refs: { sess: string; shot1: string; a: string; b: string };

beforeEach(async () => {
  services = await createTestServices();
  // scores.benchmark_id has an FK → seed a benchmark row.
  await services.kdb
    .insertInto("benchmarks")
    .values({
      id: "bm-1",
      name: "Test benchmark",
      version: 1,
      is_placeholder: 1,
      data_json: "{}",
      created_at: 0,
    })
    .execute();
  const player = await services.repos.player.create({
    name: "P",
    shootingHand: "right",
    level: "advanced",
  });
  const session = await services.repos.session.create({
    playerId: player.id,
    type: "assessment",
  });
  const shot = async () =>
    (
      await services.repos.shot.saveAnalysis({
        sessionId: session.id,
        analysis: makeShotAnalysis(),
      })
    ).id;
  refs = {
    sess: session.id,
    shot1: await shot(),
    a: await shot(),
    b: await shot(),
  };
});

describe("ScoreRepo", () => {
  it("inserts and reads back scores with breakdown JSON", async () => {
    const repo = services.repos.score;
    const inserted = await repo.insert({
      scope: "session",
      refId: refs.sess,
      benchmarkId: "bm-1",
      scoringVersion: 1,
      formScore: 71.5,
      consistencyScore: 64,
      efficiencyScore: 70,
      overallScore: 69,
      breakdown: { perMetric: { kneeFlexion: 0.8 } },
    });
    const loaded = await repo.latestForRef("session", refs.sess);
    expect(loaded).toEqual(inserted);
    expect(loaded?.breakdown).toEqual({ perMetric: { kneeFlexion: 0.8 } });
  });

  it("latestForRef returns the newest score; history is preserved", async () => {
    const repo = services.repos.score;
    await repo.insert({
      scope: "shot",
      refId: refs.shot1,
      benchmarkId: "bm-1",
      scoringVersion: 1,
      formScore: 50,
      breakdown: {},
    });
    services.clock.advance(1000);
    await repo.insert({
      scope: "shot",
      refId: refs.shot1,
      benchmarkId: "bm-1",
      scoringVersion: 2,
      formScore: 60,
      breakdown: {},
    });

    const latest = await repo.latestForRef("shot", refs.shot1);
    expect(latest?.formScore).toBe(60);
    expect(latest?.scoringVersion).toBe(2);

    const history = await repo.listForRef("shot", refs.shot1);
    expect(history.map((s) => s.formScore)).toEqual([50, 60]);
  });

  it("latestForRefs maps many refs to their latest score", async () => {
    const repo = services.repos.score;
    await repo.insert({
      scope: "shot",
      refId: refs.a,
      benchmarkId: "bm-1",
      scoringVersion: 1,
      formScore: 10,
      breakdown: {},
    });
    services.clock.advance(10);
    await repo.insert({
      scope: "shot",
      refId: refs.a,
      benchmarkId: "bm-1",
      scoringVersion: 1,
      formScore: 20,
      breakdown: {},
    });
    await repo.insert({
      scope: "shot",
      refId: refs.b,
      benchmarkId: "bm-1",
      scoringVersion: 1,
      formScore: 30,
      breakdown: {},
    });

    const map = await repo.latestForRefs("shot", [refs.a, refs.b, "missing"]);
    expect(map.get(refs.a)?.formScore).toBe(20);
    expect(map.get(refs.b)?.formScore).toBe(30);
    expect(map.has("missing")).toBe(false);
    expect(await repo.latestForRefs("shot", [])).toEqual(new Map());
  });
});

describe("SettingsRepo", () => {
  it("returns defaults for unset keys", async () => {
    const repo = services.repos.settings;
    expect(await repo.get("onboarded")).toBe(false);
    expect(await repo.get("voiceFeedback")).toBe(true);
    expect(await repo.get("activeBenchmarkId")).toBeNull();
  });

  it("sets and gets typed values", async () => {
    const repo = services.repos.settings;
    await repo.set("onboarded", true);
    await repo.set("activeBenchmarkId", "bm-1");
    expect(await repo.get("onboarded")).toBe(true);
    expect(await repo.get("activeBenchmarkId")).toBe("bm-1");
  });

  it("rejects wrongly-typed writes at runtime", async () => {
    const repo = services.repos.settings;
    await expect(
      // @ts-expect-error intentional wrong type — schema must catch it
      repo.set("onboarded", "yes"),
    ).rejects.toThrow();
  });

  it("falls back to the default when a stored value is corrupted", async () => {
    const repo = services.repos.settings;
    await services.kdb
      .insertInto("user_settings")
      .values({ user_id: TEST_USER_ID, key: "onboarded", value: "not-json{" })
      .execute();
    expect(await repo.get("onboarded")).toBe(false);
  });
});
