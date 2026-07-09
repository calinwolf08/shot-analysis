import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import { createPlayerRepo } from "$lib/shared/db/repos/player-repo";
import { createSessionRepo } from "$lib/shared/db/repos/session-repo";
import { createPlanRepo } from "../repo/plan-repo";

let services: TestServices;
let playerId: string;
let sessionId: string;

beforeEach(async () => {
  services = await createTestServices();
  playerId = (
    await createPlayerRepo(services).create({
      name: "A",
      shootingHand: "right",
      level: "youth",
    })
  ).id;
  sessionId = (
    await createSessionRepo(services).create({
      playerId,
      type: "assessment",
    })
  ).id;
});

describe("PlanRepo", () => {
  const items = [
    {
      dayIndex: 0,
      position: 0,
      type: "drill" as const,
      drillId: null,
      focusMetric: null,
      targetReps: null,
    },
    {
      dayIndex: 0,
      position: 1,
      type: "live_practice" as const,
      drillId: null,
      focusMetric: "shootingElbowFlare",
      targetReps: 20,
    },
    {
      dayIndex: 13,
      position: 0,
      type: "reassessment" as const,
      drillId: null,
      focusMetric: null,
      targetReps: null,
    },
  ];

  it("creates a plan with items atomically and reads them ordered", async () => {
    const repo = createPlanRepo(services);
    const plan = await repo.createWithItems({
      playerId,
      sourceSessionId: sessionId,
      focus: [{ issueGroup: "alignment" }],
      items,
    });
    expect(plan.status).toBe("active");

    const loadedItems = await repo.getItems(plan.id);
    expect(loadedItems).toHaveLength(3);
    expect(loadedItems.map((i) => i.type)).toEqual([
      "drill",
      "live_practice",
      "reassessment",
    ]);
    expect(loadedItems.every((i) => i.status === "pending")).toBe(true);
    expect(loadedItems[1]?.focusMetric).toBe("shootingElbowFlare");
  });

  it("getActiveByPlayer returns only the active plan", async () => {
    const repo = createPlanRepo(services);
    const p1 = await repo.createWithItems({
      playerId,
      sourceSessionId: sessionId,
      focus: [],
      items,
    });
    await repo.setStatus(p1.id, "superseded");
    services.clock.advance(100);
    const p2 = await repo.createWithItems({
      playerId,
      sourceSessionId: sessionId,
      focus: [],
      items,
    });

    expect((await repo.getActiveByPlayer(playerId))?.id).toBe(p2.id);
    expect((await repo.get(p1.id))?.status).toBe("superseded");
  });

  it("updates item status with completion timestamps", async () => {
    const repo = createPlanRepo(services);
    const plan = await repo.createWithItems({
      playerId,
      sourceSessionId: sessionId,
      focus: [],
      items,
    });
    const [first] = await repo.getItems(plan.id);
    services.clock.advance(500);
    await repo.updateItemStatus(first!.id, "done");

    const item = await repo.getItem(first!.id);
    expect(item?.status).toBe("done");
    expect(item?.completedAt).toBe(services.clock.now());

    await repo.updateItemStatus(first!.id, "pending");
    expect((await repo.getItem(first!.id))?.completedAt).toBeNull();
  });
});
