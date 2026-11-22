import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";

let services: TestServices;

beforeEach(async () => {
  services = await createTestServices();
});

describe("PlayerRepo", () => {
  it("creates and reads back a player", async () => {
    const repo = services.repos.player;
    const created = await repo.create({
      name: "Ava",
      shootingHand: "right",
      level: "youth",
    });
    expect(created.id).toBe("id-1");
    expect(created.createdAt).toBe(services.clock.now());
    const loaded = await repo.get(created.id);
    expect(loaded).toEqual(created);
  });

  it("getFirst returns null before onboarding, the player after", async () => {
    const repo = services.repos.player;
    expect(await repo.getFirst()).toBeNull();
    const created = await repo.create({
      name: "Ben",
      shootingHand: "left",
      level: "advanced",
    });
    expect((await repo.getFirst())?.id).toBe(created.id);
  });

  it("updates fields and bumps updatedAt", async () => {
    const repo = services.repos.player;
    const created = await repo.create({
      name: "Cam",
      shootingHand: "right",
      level: "youth",
    });
    services.clock.advance(5000);
    const updated = await repo.update(created.id, { level: "high-school" });
    expect(updated?.level).toBe("high-school");
    expect(updated?.updatedAt).toBe(created.updatedAt + 5000);
    expect((await repo.get(created.id))?.level).toBe("high-school");
  });

  it("update returns null for a missing player", async () => {
    const repo = services.repos.player;
    expect(await repo.update("nope", { name: "x" })).toBeNull();
  });
});

describe("VideoRepo", () => {
  it("creates and reads a video with nullable fields", async () => {
    const players = services.repos.player;
    const player = await players.create({
      name: "A",
      shootingHand: "right",
      level: "youth",
    });
    const repo = services.repos.video;
    const video = await repo.create({
      playerId: player.id,
      source: "upload",
      fileUri: "file:///vid.mp4",
      fps: 30,
    });
    const loaded = await repo.get(video.id);
    expect(loaded).toEqual(video);
    expect(loaded?.durationMs).toBeNull();
    expect(loaded?.fps).toBe(30);
  });
});

describe("SessionRepo", () => {
  async function makePlayer() {
    return services.repos.player.create({
      name: "A",
      shootingHand: "right",
      level: "youth",
    });
  }

  it("creates in_progress sessions and completes them", async () => {
    const player = await makePlayer();
    const repo = services.repos.session;
    const session = await repo.create({
      playerId: player.id,
      type: "assessment",
    });
    expect(session.status).toBe("in_progress");
    services.clock.advance(60_000);
    await repo.complete(session.id);
    const loaded = await repo.get(session.id);
    expect(loaded?.status).toBe("completed");
    expect(loaded?.completedAt).toBe(session.startedAt + 60_000);
  });

  it("aborts sessions", async () => {
    const player = await makePlayer();
    const repo = services.repos.session;
    const session = await repo.create({
      playerId: player.id,
      type: "live_practice",
      focusMetric: "shootingElbowFlare",
    });
    await repo.abort(session.id);
    expect((await repo.get(session.id))?.status).toBe("aborted");
  });

  it("lists by player with type/status filters, newest first", async () => {
    const player = await makePlayer();
    const repo = services.repos.session;
    const a = await repo.create({ playerId: player.id, type: "assessment" });
    services.clock.advance(1000);
    const b = await repo.create({
      playerId: player.id,
      type: "live_practice",
    });
    await repo.complete(b.id);

    const all = await repo.listByPlayer(player.id);
    expect(all.map((s) => s.id)).toEqual([b.id, a.id]);

    const assessments = await repo.listByPlayer(player.id, {
      type: "assessment",
    });
    expect(assessments.map((s) => s.id)).toEqual([a.id]);

    const completed = await repo.listByPlayer(player.id, {
      status: "completed",
    });
    expect(completed.map((s) => s.id)).toEqual([b.id]);
  });
});

describe("RepRepo", () => {
  it("creates reps with JSON feedback and lists in order", async () => {
    const player = await services.repos.player.create({
      name: "A",
      shootingHand: "right",
      level: "youth",
    });
    const session = await services.repos.session.create({
      playerId: player.id,
      type: "live_practice",
    });
    const repo = services.repos.rep;
    await repo.create({
      sessionId: session.id,
      repIndex: 1,
      repScore: 82,
      primaryCue: "Hold your follow-through",
      feedback: { cues: ["a", "b"] },
    });
    await repo.create({ sessionId: session.id, repIndex: 0 });

    const reps = await repo.listBySession(session.id);
    expect(reps.map((r) => r.repIndex)).toEqual([0, 1]);
    expect(reps[1]?.feedback).toEqual({ cues: ["a", "b"] });
    expect(reps[0]?.feedback).toBeNull();
  });
});
