import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import { createDrillRepo } from "../repo/drill-repo";

let services: TestServices;

beforeEach(async () => {
  services = await createTestServices();
});

describe("DrillRepo", () => {
  it("upserts, fetches by id and slug, lists sorted by slug", async () => {
    const repo = createDrillRepo(services);
    await repo.upsert({
      id: "d2",
      slug: "wall-sits",
      version: 1,
      isPlaceholder: true,
      data: { title: "Wall Sits" },
    });
    await repo.upsert({
      id: "d1",
      slug: "form-shooting",
      version: 1,
      isPlaceholder: true,
      data: { title: "Form Shooting" },
    });

    expect((await repo.get("d1"))?.slug).toBe("form-shooting");
    expect((await repo.getBySlug("wall-sits"))?.id).toBe("d2");
    expect((await repo.list()).map((d) => d.slug)).toEqual([
      "form-shooting",
      "wall-sits",
    ]);
    expect(await repo.get("missing")).toBeNull();
    expect(await repo.getBySlug("missing")).toBeNull();
  });

  it("upsert updates content on version bump", async () => {
    const repo = createDrillRepo(services);
    await repo.upsert({
      id: "d1",
      slug: "a",
      version: 1,
      isPlaceholder: true,
      data: { v: 1 },
    });
    await repo.upsert({
      id: "d1",
      slug: "a",
      version: 2,
      isPlaceholder: false,
      data: { v: 2 },
    });
    const row = await repo.get("d1");
    expect(row?.version).toBe(2);
    expect(row?.data).toEqual({ v: 2 });
  });
});
