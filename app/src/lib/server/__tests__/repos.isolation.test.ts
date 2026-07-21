import { beforeEach, describe, expect, it } from "vitest";
import type { ShotAnalysis } from "basketball-shot-analysis";
import type { DatabaseAdapter } from "$lib/shared/db";
import { migrate } from "$lib/shared/db";
import { createBetterSqliteAdapter } from "$lib/shared/db/drivers/better-sqlite3";
import type { AppRepos } from "$lib/shared/config/services";
import { createServerRepos } from "../repos";
import { ForbiddenError } from "../errors";

function fakeAnalysis(shotIndex = 0): ShotAnalysis {
  return {
    shotIndex,
    frameRange: { start: 0, end: 10 },
    orientation: "side-left",
    overallConfidence: 0.9,
    metrics: {},
    phases: {},
  } as unknown as ShotAnalysis;
}

describe("server repos — per-user isolation", () => {
  let db: DatabaseAdapter;
  let A: AppRepos;
  let B: AppRepos;

  beforeEach(async () => {
    db = createBetterSqliteAdapter({ path: ":memory:" });
    await migrate(db);
    A = createServerRepos(db, "user-a");
    B = createServerRepos(db, "user-b");
  });

  it("scopes players per user", async () => {
    const pA = await A.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });
    const pB = await B.player.create({
      name: "B",
      shootingHand: "left",
      level: "youth",
    });

    expect((await A.player.getFirst())?.id).toBe(pA.id);
    expect((await B.player.getFirst())?.id).toBe(pB.id);
    // Cross-user reads are invisible.
    expect(await A.player.get(pB.id)).toBeNull();
    expect(await B.player.get(pA.id)).toBeNull();
    // Cross-user update is a no-op that reports "not found".
    expect(await B.player.update(pA.id, { name: "hacked" })).toBeNull();
    expect((await A.player.get(pA.id))?.name).toBe("A");
  });

  it("isolates sessions and rejects cross-user writes", async () => {
    const pA = await A.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });
    const sA = await A.session.create({ playerId: pA.id, type: "assessment" });

    expect(await B.session.get(sA.id)).toBeNull();
    expect(await B.session.listByPlayer(pA.id)).toEqual([]);
    expect((await A.session.listByPlayer(pA.id)).map((s) => s.id)).toEqual([
      sA.id,
    ]);

    // B cannot create a session under A's player, nor mutate A's session.
    await expect(
      B.session.create({ playerId: pA.id, type: "assessment" }),
    ).rejects.toThrow(ForbiddenError);
    await expect(B.session.complete(sA.id)).rejects.toThrow(ForbiddenError);
    await expect(B.session.abort(sA.id)).rejects.toThrow(ForbiddenError);
  });

  it("isolates shots (scoped via owning session)", async () => {
    const pA = await A.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });
    const sA = await A.session.create({ playerId: pA.id, type: "assessment" });
    const shot = await A.shot.saveAnalysis({
      sessionId: sA.id,
      analysis: fakeAnalysis(),
    });

    expect(await B.shot.get(shot.id)).toBeNull();
    expect(await B.shot.listBySession(sA.id)).toEqual([]);
    expect((await A.shot.listBySession(sA.id)).map((s) => s.id)).toEqual([
      shot.id,
    ]);

    await expect(
      B.shot.saveAnalysis({ sessionId: sA.id, analysis: fakeAnalysis(1) }),
    ).rejects.toThrow(ForbiddenError);
    await expect(B.shot.setExcluded(shot.id, true)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("isolates scores and reps", async () => {
    const pA = await A.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });
    const sA = await A.session.create({ playerId: pA.id, type: "assessment" });
    const shot = await A.shot.saveAnalysis({
      sessionId: sA.id,
      analysis: fakeAnalysis(),
    });
    await db.run(
      `INSERT INTO benchmarks (id, name, version, is_placeholder, data_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["bench", "Bench", 1, 1, "{}", 0],
    );
    await A.score.insert({
      scope: "shot",
      refId: shot.id,
      benchmarkId: "bench",
      scoringVersion: 1,
      overallScore: 80,
      breakdown: {},
    });
    await A.rep.create({ sessionId: sA.id, repIndex: 0, shotId: shot.id });

    // B sees none of A's scores/reps.
    expect(await B.score.latestForRef("shot", shot.id)).toBeNull();
    expect(await B.score.listForRef("shot", shot.id)).toEqual([]);
    expect((await B.score.latestForRefs("shot", [shot.id])).size).toBe(0);
    expect(await B.rep.listBySession(sA.id)).toEqual([]);

    // A does.
    expect((await A.score.latestForRef("shot", shot.id))?.overallScore).toBe(
      80,
    );
    expect((await A.rep.listBySession(sA.id)).length).toBe(1);

    // B cannot write to A's shot/session.
    await expect(
      B.score.insert({
        scope: "shot",
        refId: shot.id,
        benchmarkId: "bench",
        scoringVersion: 1,
        breakdown: {},
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      B.rep.create({ sessionId: sA.id, repIndex: 1 }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("isolates videos", async () => {
    const pA = await A.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });
    const vA = await A.video.create({ playerId: pA.id, source: "upload" });
    expect(await B.video.get(vA.id)).toBeNull();
    expect((await A.video.get(vA.id))?.id).toBe(vA.id);
    await expect(
      B.video.create({ playerId: pA.id, source: "upload" }),
    ).rejects.toThrow(ForbiddenError);
  });
});
