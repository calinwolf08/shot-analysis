import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetDbSingletonForTests } from "$lib/server/db";
import { createApiClient } from "../client";
import { createRemoteRepos } from "../remote-repos";
import { inProcessFetch, type SessionUser } from "./in-process-server";
import type { AppRepos } from "$lib/shared/config/services";

const dir = mkdtempSync(join(tmpdir(), "shotcoach-remote-"));
const userA: SessionUser = { id: "user-a", email: "a@ex.com", name: "A" };
const userB: SessionUser = { id: "user-b", email: "b@ex.com", name: "B" };

function reposFor(user: SessionUser | null): AppRepos {
  return createRemoteRepos(
    createApiClient({
      fetch: inProcessFetch(user),
      baseUrl: "http://localhost",
    }),
  );
}

const fakeAnalysis = (shotIndex = 0) =>
  ({
    shotIndex,
    frameRange: { start: 0, end: 10 },
    orientation: "side-left",
    overallConfidence: 0.9,
    metrics: {},
  }) as never;

beforeAll(() => {
  process.env.DATABASE_PATH = join(dir, "remote.sqlite");
});
afterAll(() => {
  delete process.env.DATABASE_PATH;
  resetDbSingletonForTests();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => resetDbSingletonForTests());

describe("remote AppRepos over the real endpoints", () => {
  it("round-trips a player → session → shot → score → rep for the owner", async () => {
    const a = reposFor(userA);

    const player = await a.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });
    expect((await a.player.getFirst())?.id).toBe(player.id);
    expect((await a.player.get(player.id))?.name).toBe("A");

    const updated = await a.player.update(player.id, { name: "A2" });
    expect(updated?.name).toBe("A2");

    const session = await a.session.create({
      playerId: player.id,
      type: "assessment",
    });
    const listed = await a.session.listByPlayer(player.id);
    expect(listed.map((s) => s.id)).toEqual([session.id]);

    const shot = await a.shot.saveAnalysis({
      sessionId: session.id,
      analysis: fakeAnalysis(),
    });
    expect((await a.shot.listBySession(session.id)).length).toBe(1);
    expect((await a.shot.get(shot.id))?.id).toBe(shot.id);

    await a.shot.setExcluded(shot.id, true);
    expect((await a.shot.listBySession(session.id)).length).toBe(0);
    expect(
      (await a.shot.listBySession(session.id, { includeExcluded: true }))
        .length,
    ).toBe(1);

    const score = await a.score.insert({
      scope: "session",
      refId: session.id,
      benchmarkId: "elite-placeholder-v1",
      scoringVersion: 1,
      overallScore: 80,
      breakdown: { x: 1 },
    });
    expect((await a.score.latestForRef("session", session.id))?.id).toBe(
      score.id,
    );
    expect((await a.score.listForRef("session", session.id)).length).toBe(1);
    const map = await a.score.latestForRefs("session", [session.id]);
    expect(map.get(session.id)?.id).toBe(score.id);

    const rep = await a.rep.create({ sessionId: session.id, repIndex: 0 });
    expect((await a.rep.listBySession(session.id)).map((r) => r.id)).toEqual([
      rep.id,
    ]);

    await a.settings.set("activeBenchmarkId", "custom");
    expect(await a.settings.get("activeBenchmarkId")).toBe("custom");

    await a.session.complete(session.id);
    expect((await a.session.get(session.id))?.status).toBe("completed");
  });

  it("keeps users isolated (B cannot see or mutate A's data)", async () => {
    const a = reposFor(userA);
    const b = reposFor(userB);

    const player = await a.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });
    const session = await a.session.create({
      playerId: player.id,
      type: "assessment",
    });

    expect(await b.player.getFirst()).toBeNull();
    expect(await b.session.listByPlayer(player.id)).toEqual([]);
    await expect(
      b.session.create({ playerId: player.id, type: "assessment" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(b.session.complete(session.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("rejects unauthenticated calls with 401", async () => {
    const anon = reposFor(null);
    await expect(anon.player.getFirst()).rejects.toMatchObject({ status: 401 });
  });
});
