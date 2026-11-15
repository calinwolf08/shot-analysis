import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import { makeShotAnalysis } from "$lib/shared/testing/fixtures";
import { createPlayerRepo } from "../player-repo";
import { createSessionRepo } from "../session-repo";
import { createShotRepo } from "../shot-repo";

let services: TestServices;
let sessionId: string;
let playerId: string;

beforeEach(async () => {
  services = await createTestServices();
  const player = await createPlayerRepo(services).create({
    name: "A",
    shootingHand: "right",
    level: "youth",
  });
  playerId = player.id;
  sessionId = (
    await createSessionRepo(services).create({
      playerId: player.id,
      type: "assessment",
    })
  ).id;
});

describe("ShotRepo.saveAnalysis", () => {
  it("round-trips a full ShotAnalysis through analysis_json", async () => {
    const repo = createShotRepo(services);
    const analysis = makeShotAnalysis({
      shotIndex: 2,
      orientation: "side-right",
    });
    const saved = await repo.saveAnalysis({ sessionId, analysis });

    expect(saved.shotIndex).toBe(2);
    expect(saved.playerId).toBe(playerId); // derived from the session
    expect(saved.sessionId).toBe(sessionId);
    expect(saved.orientation).toBe("side-right");
    expect(saved.startFrame).toBe(analysis.frameRange.start);
    expect(saved.endFrame).toBe(analysis.frameRange.end);

    const loaded = await repo.get(saved.id);
    expect(loaded?.analysis).toEqual(analysis); // exact round-trip
  });

  it("writes a consistent shot_metrics projection (numeric + categorical)", async () => {
    const repo = createShotRepo(services);
    const analysis = makeShotAnalysis();
    const saved = await repo.saveAnalysis({ sessionId, analysis });

    const rows = await services.db.query<{
      metric_name: string;
      value_num: number | null;
      value_text: string | null;
      unit: string;
      confidence: number;
    }>("SELECT * FROM shot_metrics WHERE shot_id = ? ORDER BY metric_name", [
      saved.id,
    ]);

    expect(rows).toHaveLength(Object.keys(analysis.metrics).length);

    const elbow = rows.find((r) => r.metric_name === "shootingElbowAngle");
    expect(elbow?.value_num).toBe(88);
    expect(elbow?.value_text).toBeNull();
    expect(elbow?.unit).toBe("degrees");

    const guide = rows.find((r) => r.metric_name === "guideHandPosition");
    expect(guide?.value_num).toBeNull();
    expect(guide?.value_text).toBe("side");
  });

  it("rolls back atomically when the metrics write fails", async () => {
    const repo = createShotRepo(services);
    // Metric name with a NUL-free but absurdly long name still works; force
    // failure via a duplicate metric insert instead: craft an analysis whose
    // serialization succeeds but insert violates the PK by duplicating names
    // after case folding is NOT possible in SQLite… so instead simulate
    // failure by dropping the shot_metrics table mid-flight.
    await services.db.run("DROP TABLE shot_metrics");
    await expect(
      repo.saveAnalysis({ sessionId, analysis: makeShotAnalysis() }),
    ).rejects.toThrow();

    const shots = await services.db.query("SELECT id FROM shots");
    expect(shots).toHaveLength(0); // the shots insert rolled back too
  });

  it("listBySession respects excluded flag and ordering", async () => {
    const repo = createShotRepo(services);
    const s0 = await repo.saveAnalysis({
      sessionId,
      analysis: makeShotAnalysis({ shotIndex: 0 }),
    });
    const s1 = await repo.saveAnalysis({
      sessionId,
      analysis: makeShotAnalysis({ shotIndex: 1 }),
    });

    await repo.setExcluded(s0.id, true);

    const included = await repo.listBySession(sessionId);
    expect(included.map((s) => s.id)).toEqual([s1.id]);

    const all = await repo.listBySession(sessionId, {
      includeExcluded: true,
    });
    expect(all.map((s) => s.id)).toEqual([s0.id, s1.id]);
    expect(all[0]?.excluded).toBe(true);

    await repo.setExcluded(s0.id, false);
    expect(await repo.listBySession(sessionId)).toHaveLength(2);
  });
});

describe("ShotRepo player-rooted (de-sessioned) shots", () => {
  it("saves a shot with only a playerId (no session)", async () => {
    const repo = createShotRepo(services);
    const saved = await repo.saveAnalysis({
      playerId,
      analysis: makeShotAnalysis(),
    });
    expect(saved.playerId).toBe(playerId);
    expect(saved.sessionId).toBeNull();

    const loaded = await repo.get(saved.id);
    expect(loaded?.sessionId).toBeNull();
    expect(loaded?.playerId).toBe(playerId);
  });

  it("throws when neither playerId nor sessionId is given", async () => {
    const repo = createShotRepo(services);
    await expect(
      repo.saveAnalysis({ analysis: makeShotAnalysis() }),
    ).rejects.toThrow();
  });

  it("persists and reads back a review pose track", async () => {
    const repo = createShotRepo(services);
    const reviewPoses = {
      fps: 30,
      frames: [
        { frameIndex: 0, landmarks: [{ x: 0.1, y: 0.2, visibility: 0.9 }] },
        { frameIndex: 1, landmarks: [{ x: 0.15, y: 0.25, visibility: 0.8 }] },
      ],
    };
    const saved = await repo.saveAnalysis({
      playerId,
      analysis: makeShotAnalysis(),
      reviewPoses,
    });
    expect(await repo.getPoses(saved.id)).toEqual(reviewPoses);

    // A shot saved without poses has none.
    const bare = await repo.saveAnalysis({
      playerId,
      analysis: makeShotAnalysis(),
    });
    expect(await repo.getPoses(bare.id)).toBeNull();
  });

  it("listByPlayer returns newest-first and honors since/limit/excluded", async () => {
    const repo = createShotRepo(services);
    const a = await repo.saveAnalysis({
      playerId,
      analysis: makeShotAnalysis({ shotIndex: 0 }),
    });
    services.clock.advance(1000);
    const b = await repo.saveAnalysis({
      playerId,
      analysis: makeShotAnalysis({ shotIndex: 1 }),
    });
    services.clock.advance(1000);
    const c = await repo.saveAnalysis({
      playerId,
      analysis: makeShotAnalysis({ shotIndex: 2 }),
    });

    // Newest first.
    expect((await repo.listByPlayer(playerId)).map((s) => s.id)).toEqual([
      c.id,
      b.id,
      a.id,
    ]);
    // Limit.
    expect(
      (await repo.listByPlayer(playerId, { limit: 2 })).map((s) => s.id),
    ).toEqual([c.id, b.id]);
    // Since (b and c were saved at/after b's createdAt).
    expect(
      (await repo.listByPlayer(playerId, { since: b.createdAt })).map(
        (s) => s.id,
      ),
    ).toEqual([c.id, b.id]);
    // Excluded filtered out by default, included on request.
    await repo.setExcluded(c.id, true);
    expect((await repo.listByPlayer(playerId)).map((s) => s.id)).toEqual([
      b.id,
      a.id,
    ]);
    expect(
      (await repo.listByPlayer(playerId, { includeExcluded: true })).map(
        (s) => s.id,
      ),
    ).toEqual([c.id, b.id, a.id]);
  });
});
