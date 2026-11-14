import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, resetDbSingletonForTests } from "$lib/server/db";
import { createFocusAreaRepo } from "$lib/features/diagnosis";
import { systemClock, uuidIdGenerator } from "$lib/shared/utils";
import { createApiClient, type ApiClient } from "../client";
import { createRemoteRepos } from "../remote-repos";
import {
  createRemoteBenchmarks,
  createRemoteDiagnosis,
  createRemoteDrills,
  createRemoteProgress,
  createRemoteTrainingPlan,
} from "../remote-services";
import { inProcessFetch, type SessionUser } from "./in-process-server";

const dir = mkdtempSync(join(tmpdir(), "shotcoach-rsvc-"));
const userA: SessionUser = { id: "user-a", email: "a@ex.com", name: "A" };
const userB: SessionUser = { id: "user-b", email: "b@ex.com", name: "B" };

function clientFor(user: SessionUser | null): ApiClient {
  return createApiClient({
    fetch: inProcessFetch(user),
    baseUrl: "http://localhost",
  });
}

async function seedFocus(sessionId: string) {
  const db = await getDb();
  const repo = createFocusAreaRepo({
    db,
    clock: systemClock,
    ids: uuidIdGenerator,
  });
  await repo.replaceForSession(sessionId, [
    {
      rank: 1,
      issueGroup: "alignment",
      severity: 0.8,
      metrics: {
        displayName: "Alignment",
        whyItMatters: "test",
        surfaced: true,
        metrics: [{ metric: "shootingElbowFlare", severity: 0.8 }],
      },
    },
  ]);
}

beforeAll(() => {
  process.env.DATABASE_PATH = join(dir, "rsvc.sqlite");
});
afterAll(() => {
  delete process.env.DATABASE_PATH;
  resetDbSingletonForTests();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => resetDbSingletonForTests());

describe("remote domain services over the real endpoints", () => {
  it("reads the global catalogs", async () => {
    const api = clientFor(userA);
    const benchmarks = createRemoteBenchmarks(api);
    const drills = createRemoteDrills(api);

    expect((await benchmarks.getActive()).id).toBeTruthy();
    const list = await drills.list();
    expect(list.length).toBeGreaterThan(0);
    expect((await drills.getBySlug(list[0]!.slug))?.slug).toBe(list[0]!.slug);
    expect(await drills.get("does-not-exist")).toBeNull();
  });

  it("serves progress, diagnosis and the plan lifecycle for the owner", async () => {
    const api = clientFor(userA);
    const repos = createRemoteRepos(api);
    const progress = createRemoteProgress(api);
    const diagnosis = createRemoteDiagnosis(api);
    const plans = createRemoteTrainingPlan(api);

    const player = await repos.player.create({
      name: "A",
      shootingHand: "right",
      level: "high-school",
    });
    const session = await repos.session.create({
      playerId: player.id,
      type: "assessment",
    });
    await seedFocus(session.id);

    // Progress read-models (empty but shaped) for a fresh player.
    expect(await progress.scoreHistory(player.id)).toEqual([]);
    expect((await progress.totals(player.id)).sessions).toBe(0);
    expect(await progress.metricTrend(player.id, "kneeFlexion")).toEqual([]);

    const areas = await diagnosis.listForSession(session.id);
    expect(areas.length).toBe(1);

    const plan = await plans.generateForSession(session.id, player.id);
    expect(plan.status).toBe("active");
    const withItems = await plans.getPlan(plan.id);
    expect(withItems?.items.length).toBeGreaterThan(0);

    const active = await plans.getActivePlan(player.id);
    expect(active?.plan.id).toBe(plan.id);

    const next = await plans.nextPendingItem(player.id);
    expect(next?.plan.id).toBe(plan.id);

    await plans.completeItem(next!.item.id);
    // completing every item leaves no next pending item
    for (const item of withItems!.items) await plans.completeItem(item.id);
    expect(await plans.nextPendingItem(player.id)).toBeNull();
  });

  it("blocks a stranger from another user's progress/plans", async () => {
    const a = createRemoteRepos(clientFor(userA));
    const player = await a.player.create({
      name: "A",
      shootingHand: "right",
      level: "high-school",
    });

    const bProgress = createRemoteProgress(clientFor(userB));
    await expect(bProgress.totals(player.id)).rejects.toMatchObject({
      status: 403,
    });
  });
});
