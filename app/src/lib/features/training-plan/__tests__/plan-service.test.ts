import { beforeEach, describe, expect, it } from "vitest";
import { createFocusAreaRepo } from "$lib/features/diagnosis";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import { PLAN_CONFIG, type PlanFocusArea } from "../generator";

let services: TestServices;
let playerId: string;

async function newAssessmentSession(): Promise<string> {
  const session = await services.repos.session.create({
    playerId,
    type: "assessment",
  });
  return session.id;
}

/** Persists surfaced focus rows the way the diagnosis service does. */
async function seedFocus(
  sessionId: string,
  areas: { group: string; severity: number; metric: string }[],
) {
  const repo = createFocusAreaRepo(services);
  await repo.replaceForSession(
    sessionId,
    areas.map((a, i) => ({
      rank: i + 1,
      issueGroup: a.group,
      severity: a.severity,
      metrics: {
        displayName: a.group,
        whyItMatters: "test",
        surfaced: true,
        metrics: [{ metric: a.metric, severity: a.severity }],
      },
    })),
  );
}

beforeEach(async () => {
  services = await createTestServices();
  await services.drills.seed();
  const player = await services.repos.player.create({
    name: "Testy",
    shootingHand: "right",
    level: "high-school",
  });
  playerId = player.id;
});

describe("generateForSession", () => {
  it("persists an active plan with items from the session's focus areas", async () => {
    const sessionId = await newAssessmentSession();
    await seedFocus(sessionId, [
      { group: "alignment", severity: 0.8, metric: "shootingElbowFlare" },
      { group: "rhythm", severity: 0.6, metric: "ballLegSync" },
    ]);

    const plan = await services.trainingPlan.generateForSession(
      sessionId,
      playerId,
    );
    expect(plan.status).toBe("active");
    expect(plan.sourceSessionId).toBe(sessionId);
    const focus = plan.focus as PlanFocusArea[];
    expect(focus.map((f) => f.issueGroup)).toEqual(["alignment", "rhythm"]);

    const stored = await services.trainingPlan.getPlan(plan.id);
    expect(stored).not.toBeNull();
    expect(stored!.items.at(-1)!.type).toBe("reassessment");
    expect(stored!.items.every((i) => i.status === "pending")).toBe(true);
  });

  it("supersedes the previous active plan", async () => {
    const first = await newAssessmentSession();
    await seedFocus(first, [
      { group: "alignment", severity: 0.8, metric: "shootingElbowFlare" },
    ]);
    const plan1 = await services.trainingPlan.generateForSession(
      first,
      playerId,
    );

    const second = await newAssessmentSession();
    await seedFocus(second, [
      { group: "posture", severity: 0.7, metric: "backPosture" },
    ]);
    const plan2 = await services.trainingPlan.generateForSession(
      second,
      playerId,
    );

    const active = await services.trainingPlan.getActivePlan(playerId);
    expect(active!.plan.id).toBe(plan2.id);
    const old = await services.trainingPlan.getPlan(plan1.id);
    expect(old!.plan.status).toBe("superseded");
  });

  it("adapts on re-assessment: improved focus rotates out, new rotates in", async () => {
    const first = await newAssessmentSession();
    await seedFocus(first, [
      { group: "alignment", severity: 0.8, metric: "shootingElbowFlare" },
      { group: "rhythm", severity: 0.6, metric: "ballLegSync" },
    ]);
    await services.trainingPlan.generateForSession(first, playerId);

    const second = await newAssessmentSession();
    await seedFocus(second, [
      // alignment improved well past the threshold → rotates out
      {
        group: "alignment",
        severity: 0.8 - PLAN_CONFIG.improvementThreshold - 0.05,
        metric: "shootingElbowFlare",
      },
      // rhythm barely moved → stays
      { group: "rhythm", severity: 0.58, metric: "ballLegSync" },
      // new issue → rotates in
      { group: "posture", severity: 0.4, metric: "backPosture" },
    ]);
    const plan2 = await services.trainingPlan.generateForSession(
      second,
      playerId,
    );
    const focus = plan2.focus as PlanFocusArea[];
    expect(focus.map((f) => f.issueGroup).sort()).toEqual([
      "posture",
      "rhythm",
    ]);
  });

  it("throws for an unknown player", async () => {
    const sessionId = await newAssessmentSession();
    await expect(
      services.trainingPlan.generateForSession(sessionId, "ghost"),
    ).rejects.toThrow(/Unknown player/);
  });
});

describe("item progression", () => {
  it("completeItem advances nextPendingItem in day/position order", async () => {
    const sessionId = await newAssessmentSession();
    await seedFocus(sessionId, [
      { group: "alignment", severity: 0.8, metric: "shootingElbowFlare" },
    ]);
    const plan = await services.trainingPlan.generateForSession(
      sessionId,
      playerId,
    );
    const { items } = (await services.trainingPlan.getPlan(plan.id))!;

    const first = await services.trainingPlan.nextPendingItem(playerId);
    expect(first!.item.id).toBe(items[0]!.id);
    expect(first!.plan.id).toBe(plan.id);

    await services.trainingPlan.completeItem(items[0]!.id);
    const second = await services.trainingPlan.nextPendingItem(playerId);
    expect(second!.item.id).toBe(items[1]!.id);

    const refreshed = (await services.trainingPlan.getPlan(plan.id))!;
    expect(refreshed.items[0]!.status).toBe("done");
    expect(refreshed.items[0]!.completedAt).not.toBeNull();
  });

  it("nextPendingItem is null with no active plan or when all done", async () => {
    expect(await services.trainingPlan.nextPendingItem(playerId)).toBeNull();

    const sessionId = await newAssessmentSession();
    await seedFocus(sessionId, [
      { group: "alignment", severity: 0.8, metric: "shootingElbowFlare" },
    ]);
    const plan = await services.trainingPlan.generateForSession(
      sessionId,
      playerId,
    );
    const { items } = (await services.trainingPlan.getPlan(plan.id))!;
    for (const item of items) {
      await services.trainingPlan.completeItem(item.id);
    }
    expect(await services.trainingPlan.nextPendingItem(playerId)).toBeNull();
  });
});
