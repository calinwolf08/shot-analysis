import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import elitePlaceholderV1 from "../data/elite-placeholder-v1.json";
import { createBenchmarkRepo } from "../repo/benchmark-repo";
import {
  InvalidBenchmarkError,
  METRIC_NAMES,
  parseBenchmarkProfile,
  type BenchmarkProfile,
} from "../schema";
import {
  builtInBenchmarks,
  createBenchmarkService,
  DEFAULT_BENCHMARK_ID,
} from "../service";

describe("elite-placeholder-v1 JSON", () => {
  it("validates against the schema", () => {
    expect(() => parseBenchmarkProfile(elitePlaceholderV1)).not.toThrow();
  });

  it("covers all 26 metrics with feedback + player copy", () => {
    const profile = parseBenchmarkProfile(elitePlaceholderV1);
    expect(profile.isPlaceholder).toBe(true);
    expect(Object.keys(profile.targets)).toHaveLength(METRIC_NAMES.length);
    for (const name of METRIC_NAMES) {
      const target = profile.targets[name];
      expect(target, name).toBeDefined();
      expect(target!.displayName.length, name).toBeGreaterThan(0);
      expect(target!.shortCue.split(/\s+/).length, name).toBeLessThanOrEqual(4);
      expect(target!.explanation.length, name).toBeGreaterThan(20);
      const hasFeedback =
        target!.feedback.tooLow ??
        target!.feedback.tooHigh ??
        target!.feedback.incorrect;
      expect(hasFeedback, `${name} needs feedback copy`).toBeTruthy();
      expect(target!.populationStats).toBeNull();
    }
  });

  it("keeps numeric ideals inside their acceptable ranges", () => {
    const profile = parseBenchmarkProfile(elitePlaceholderV1);
    for (const [name, target] of Object.entries(profile.targets)) {
      if (
        typeof target.ideal === "number" &&
        !Array.isArray(target.acceptable)
      ) {
        expect(target.ideal, name).toBeGreaterThanOrEqual(
          target.acceptable.min,
        );
        expect(target.ideal, name).toBeLessThanOrEqual(target.acceptable.max);
      }
    }
  });
});

describe("BenchmarkService", () => {
  let services: TestServices;

  beforeEach(async () => {
    services = await createTestServices();
  });

  function makeService(builtIns?: BenchmarkProfile[]) {
    return createBenchmarkService(services, {
      settings: services.repos.settings,
      ...(builtIns ? { builtIns } : {}),
    });
  }

  it("seeds built-ins and getActive returns the default", async () => {
    const service = makeService();
    await service.seed();
    const active = await service.getActive();
    expect(active.id).toBe(DEFAULT_BENCHMARK_ID);
    expect(active.isPlaceholder).toBe(true);
    expect((await service.list()).map((b) => b.id)).toContain(
      DEFAULT_BENCHMARK_ID,
    );
  });

  it("seeding is idempotent", async () => {
    const service = makeService();
    await service.seed();
    await service.seed();
    expect(await service.list()).toHaveLength(1);
  });

  it("re-seeds when the built-in version bumps", async () => {
    const v1 = builtInBenchmarks()[0]!;
    const service1 = makeService([v1]);
    await service1.seed();

    const v2: BenchmarkProfile = { ...v1, version: 2, name: "Updated" };
    const service2 = makeService([v2]);
    await service2.seed();

    const stored = await service2.get(v1.id);
    expect(stored?.version).toBe(2);
    expect(stored?.name).toBe("Updated");
  });

  it("does not downgrade a newer stored version", async () => {
    const v1 = builtInBenchmarks()[0]!;
    const newer: BenchmarkProfile = { ...v1, version: 5, name: "Newer" };
    const serviceNewer = makeService([newer]);
    await serviceNewer.seed();

    const serviceOld = makeService([v1]); // version 1
    await serviceOld.seed();
    expect((await serviceOld.get(v1.id))?.version).toBe(5);
  });

  it("honors the activeBenchmarkId setting with fallback to default", async () => {
    const service = makeService();
    await service.seed();
    await services.repos.settings.set("activeBenchmarkId", "does-not-exist");
    const active = await service.getActive();
    expect(active.id).toBe(DEFAULT_BENCHMARK_ID);
  });

  it("throws a typed error for corrupted stored JSON", async () => {
    const service = makeService();
    const repo = createBenchmarkRepo(services);
    await repo.upsert({
      id: "corrupt",
      name: "Corrupt",
      version: 1,
      isPlaceholder: true,
      data: { nope: true },
    });
    await expect(service.get("corrupt")).rejects.toThrow(InvalidBenchmarkError);
  });
});
