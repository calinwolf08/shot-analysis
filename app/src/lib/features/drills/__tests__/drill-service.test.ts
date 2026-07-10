import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import drillsJson from "../data/drills.json";
import { createDrillRepo } from "../repo/drill-repo";
import { createDrillService, type DrillService } from "../service";

let services: TestServices;
let drills: DrillService;

beforeEach(async () => {
  services = await createTestServices();
  drills = services.drills;
  await drills.seed();
});

describe("seed", () => {
  it("inserts the full catalog, idempotently", async () => {
    expect(await drills.list()).toHaveLength(12);
    await drills.seed();
    expect(await drills.list()).toHaveLength(12);
  });

  it("upgrades rows when the shipped version is newer, not older", async () => {
    const repo = createDrillRepo(services);
    const v2 = {
      ...drillsJson,
      version: 2,
      drills: drillsJson.drills.map((d) =>
        d.id === "drill-chair-shooting" ? { ...d, title: "Chair 2.0" } : d,
      ),
    };
    await createDrillService(services, { file: v2 }).seed();
    expect((await drills.get("drill-chair-shooting"))?.title).toBe("Chair 2.0");
    expect((await repo.get("drill-chair-shooting"))?.version).toBe(2);

    // Re-seeding the shipped v1 must not downgrade the stored v2 row.
    await drills.seed();
    expect((await drills.get("drill-chair-shooting"))?.title).toBe("Chair 2.0");
  });

  it("rejects an invalid catalog up front", () => {
    expect(() =>
      createDrillService(services, {
        file: { version: 1, drills: [{ id: "broken" }] },
      }),
    ).toThrow(/Invalid drill content/);
  });
});

describe("lookups", () => {
  it("gets by id and by slug", async () => {
    const byId = await drills.get("drill-chair-shooting");
    expect(byId?.slug).toBe("chair-shooting");
    const bySlug = await drills.getBySlug("chair-shooting");
    expect(bySlug?.id).toBe("drill-chair-shooting");
    expect(await drills.get("nope")).toBeNull();
    expect(await drills.getBySlug("nope")).toBeNull();
  });
});

describe("findForFocus", () => {
  it("matches by issue group", async () => {
    const found = await drills.findForFocus({ issueGroups: ["guide-hand"] });
    expect(found.length).toBeGreaterThan(0);
    for (const d of found) expect(d.issueGroups).toContain("guide-hand");
  });

  it("ranks focus-metric overlap above issue-group overlap", async () => {
    const found = await drills.findForFocus({
      issueGroups: ["lower-body"],
      focusMetrics: ["kneeFlexion", "ballLegSync"],
    });
    // chair-shooting hits both metrics; wall-sits hits one.
    expect(found[0]!.slug).toBe("chair-shooting");
    const slugs = found.map((d) => d.slug);
    expect(slugs.indexOf("chair-shooting")).toBeLessThan(
      slugs.indexOf("wall-sits-shot-pocket"),
    );
  });

  it("filters by max difficulty", async () => {
    const found = await drills.findForFocus({
      issueGroups: ["rhythm"],
      maxDifficulty: 2,
    });
    expect(found.length).toBeGreaterThan(0);
    for (const d of found) expect(d.difficulty).toBeLessThanOrEqual(2);
  });

  it("returns the whole catalog (easiest first) for an empty focus", async () => {
    const found = await drills.findForFocus({});
    expect(found).toHaveLength(12);
    const difficulties = found.map((d) => d.difficulty);
    expect(difficulties).toEqual([...difficulties].sort((a, b) => a - b));
  });

  it("excludes drills with no overlap when a focus is given", async () => {
    const found = await drills.findForFocus({ issueGroups: ["posture"] });
    for (const d of found) expect(d.issueGroups).toContain("posture");
  });
});
