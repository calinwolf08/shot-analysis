import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import { createBenchmarkRepo } from "../repo/benchmark-repo";

let services: TestServices;

beforeEach(async () => {
  services = await createTestServices();
});

describe("BenchmarkRepo", () => {
  it("upserts and reads benchmarks with JSON payloads", async () => {
    const repo = createBenchmarkRepo(services);
    await repo.upsert({
      id: "elite-placeholder-v1",
      name: "Elite Shooter (sample data)",
      version: 1,
      isPlaceholder: true,
      data: { targets: { kneeFlexion: { ideal: 120 } } },
    });
    const row = await repo.get("elite-placeholder-v1");
    expect(row?.isPlaceholder).toBe(true);
    expect(row?.data).toEqual({ targets: { kneeFlexion: { ideal: 120 } } });
  });

  it("upsert replaces on conflict (version bump)", async () => {
    const repo = createBenchmarkRepo(services);
    await repo.upsert({
      id: "b",
      name: "v1",
      version: 1,
      isPlaceholder: true,
      data: {},
    });
    await repo.upsert({
      id: "b",
      name: "v2",
      version: 2,
      isPlaceholder: false,
      data: { updated: true },
    });
    const row = await repo.get("b");
    expect(row?.version).toBe(2);
    expect(row?.isPlaceholder).toBe(false);
    expect((await repo.list()).length).toBe(1);
  });
});
