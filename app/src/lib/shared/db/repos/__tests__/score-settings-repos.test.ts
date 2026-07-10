import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import { createScoreRepo } from "../score-repo";
import { createSettingsRepo } from "../settings-repo";

let services: TestServices;

beforeEach(async () => {
  services = await createTestServices();
  // scores.benchmark_id has an FK → seed a benchmark row.
  await services.db.run(
    `INSERT INTO benchmarks (id, name, version, is_placeholder, data_json, created_at)
     VALUES ('bm-1', 'Test benchmark', 1, 1, '{}', 0)`,
  );
});

describe("ScoreRepo", () => {
  it("inserts and reads back scores with breakdown JSON", async () => {
    const repo = createScoreRepo(services);
    const inserted = await repo.insert({
      scope: "session",
      refId: "sess-1",
      benchmarkId: "bm-1",
      scoringVersion: 1,
      formScore: 71.5,
      consistencyScore: 64,
      efficiencyScore: 70,
      overallScore: 69,
      breakdown: { perMetric: { kneeFlexion: 0.8 } },
    });
    const loaded = await repo.latestForRef("session", "sess-1");
    expect(loaded).toEqual(inserted);
    expect(loaded?.breakdown).toEqual({ perMetric: { kneeFlexion: 0.8 } });
  });

  it("latestForRef returns the newest score; history is preserved", async () => {
    const repo = createScoreRepo(services);
    await repo.insert({
      scope: "shot",
      refId: "shot-1",
      benchmarkId: "bm-1",
      scoringVersion: 1,
      formScore: 50,
      breakdown: {},
    });
    services.clock.advance(1000);
    await repo.insert({
      scope: "shot",
      refId: "shot-1",
      benchmarkId: "bm-1",
      scoringVersion: 2,
      formScore: 60,
      breakdown: {},
    });

    const latest = await repo.latestForRef("shot", "shot-1");
    expect(latest?.formScore).toBe(60);
    expect(latest?.scoringVersion).toBe(2);

    const history = await repo.listForRef("shot", "shot-1");
    expect(history.map((s) => s.formScore)).toEqual([50, 60]);
  });

  it("latestForRefs maps many refs to their latest score", async () => {
    const repo = createScoreRepo(services);
    await repo.insert({
      scope: "shot",
      refId: "a",
      benchmarkId: "bm-1",
      scoringVersion: 1,
      formScore: 10,
      breakdown: {},
    });
    services.clock.advance(10);
    await repo.insert({
      scope: "shot",
      refId: "a",
      benchmarkId: "bm-1",
      scoringVersion: 1,
      formScore: 20,
      breakdown: {},
    });
    await repo.insert({
      scope: "shot",
      refId: "b",
      benchmarkId: "bm-1",
      scoringVersion: 1,
      formScore: 30,
      breakdown: {},
    });

    const map = await repo.latestForRefs("shot", ["a", "b", "missing"]);
    expect(map.get("a")?.formScore).toBe(20);
    expect(map.get("b")?.formScore).toBe(30);
    expect(map.has("missing")).toBe(false);
    expect(await repo.latestForRefs("shot", [])).toEqual(new Map());
  });
});

describe("SettingsRepo", () => {
  it("returns defaults for unset keys", async () => {
    const repo = createSettingsRepo(services);
    expect(await repo.get("onboarded")).toBe(false);
    expect(await repo.get("voiceFeedback")).toBe(true);
    expect(await repo.get("activeBenchmarkId")).toBeNull();
  });

  it("sets and gets typed values", async () => {
    const repo = createSettingsRepo(services);
    await repo.set("onboarded", true);
    await repo.set("activeBenchmarkId", "bm-1");
    expect(await repo.get("onboarded")).toBe(true);
    expect(await repo.get("activeBenchmarkId")).toBe("bm-1");
  });

  it("rejects wrongly-typed writes at runtime", async () => {
    const repo = createSettingsRepo(services);
    await expect(
      // @ts-expect-error intentional wrong type — schema must catch it
      repo.set("onboarded", "yes"),
    ).rejects.toThrow();
  });

  it("falls back to the default when a stored value is corrupted", async () => {
    const repo = createSettingsRepo(services);
    await services.db.run(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('onboarded', 'not-json{')",
    );
    expect(await repo.get("onboarded")).toBe(false);
  });
});
