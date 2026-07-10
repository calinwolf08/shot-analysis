/**
 * Service-level re-assessment loop: assessment A → plan → improved
 * assessment B via the plan's reassessment item → adapted plan.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createFocusAreaRepo } from "$lib/features/diagnosis";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import { PLAN_CONFIG, type PlanFocusArea } from "../generator";

let services: TestServices;
let playerId: string;

async function assessmentSession(): Promise<string> {
  const session = await services.repos.session.create({
    playerId,
    type: "assessment",
  });
  return session.id;
}

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
  playerId = (
    await services.repos.player.create({
      name: "Loop",
      shootingHand: "right",
      level: "high-school",
    })
  ).id;
});

describe("re-assessment loop", () => {
  it("reassessment item → adapted plan; old plan superseded, item done", async () => {
    // Assessment A → first plan.
    const sessionA = await assessmentSession();
    await seedFocus(sessionA, [
      { group: "alignment", severity: 0.8, metric: "shootingElbowFlare" },
      { group: "rhythm", severity: 0.6, metric: "ballLegSync" },
    ]);
    const plan1 = await services.trainingPlan.generateForSession(
      sessionA,
      playerId,
    );
    const items1 = (await services.trainingPlan.getPlan(plan1.id))!.items;
    const reassessItem = items1.find((i) => i.type === "reassessment")!;

    // Assessment B: alignment improved past the threshold, rhythm flat,
    // posture newly surfaced.
    const sessionB = await assessmentSession();
    await seedFocus(sessionB, [
      {
        group: "alignment",
        severity: 0.8 - PLAN_CONFIG.improvementThreshold - 0.05,
        metric: "shootingElbowFlare",
      },
      { group: "rhythm", severity: 0.58, metric: "ballLegSync" },
      { group: "posture", severity: 0.4, metric: "backPosture" },
    ]);

    const plan2 = await services.trainingPlan.completeReassessment(
      sessionB,
      playerId,
      reassessItem.id,
    );

    // The old block is closed out…
    const old = (await services.trainingPlan.getPlan(plan1.id))!;
    expect(old.plan.status).toBe("superseded");
    expect(old.items.find((i) => i.id === reassessItem.id)!.status).toBe(
      "done",
    );

    // …and the new block rotated the improved focus out, new issue in.
    const active = await services.trainingPlan.getActivePlan(playerId);
    expect(active!.plan.id).toBe(plan2.id);
    expect(plan2.sourceSessionId).toBe(sessionB);
    const focus = plan2.focus as PlanFocusArea[];
    expect(focus.map((f) => f.issueGroup).sort()).toEqual([
      "posture",
      "rhythm",
    ]);
    expect(active!.items.at(-1)!.type).toBe("reassessment");
    expect(active!.items.every((i) => i.status === "pending")).toBe(true);
  });
});
