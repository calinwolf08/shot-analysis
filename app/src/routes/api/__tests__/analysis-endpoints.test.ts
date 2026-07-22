import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDbSingletonForTests } from "$lib/server/db";
import { createApiClient, type ApiClient } from "$lib/shared/api/client";
import { createRemoteRepos } from "$lib/shared/api/remote-repos";
import {
  inProcessFetch,
  type SessionUser,
} from "$lib/shared/api/__tests__/in-process-server";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(
  here,
  "..",
  "..",
  "..",
  "..",
  "src-tests",
  "fixtures",
  "poses",
);
const manifest = JSON.parse(
  readFileSync(join(fixturesDir, "manifest.json"), "utf8"),
) as { fixtures: { id: string; expectedShots: number }[] };
const fixture = manifest.fixtures[0]!;
const poseData = JSON.parse(
  readFileSync(join(fixturesDir, `${fixture.id}.json`), "utf8"),
);

const dir = mkdtempSync(join(tmpdir(), "shotcoach-analysis-"));
const userA: SessionUser = { id: "user-a", email: "a@ex.com", name: "A" };
const userB: SessionUser = { id: "user-b", email: "b@ex.com", name: "B" };

function clientFor(user: SessionUser | null): ApiClient {
  return createApiClient({
    fetch: inProcessFetch(user),
    baseUrl: "http://localhost",
  });
}

beforeAll(() => {
  process.env.DATABASE_PATH = join(dir, "analysis.sqlite");
});
afterAll(() => {
  delete process.env.DATABASE_PATH;
  resetDbSingletonForTests();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => resetDbSingletonForTests());

describe("/api/analysis endpoints", () => {
  it("runs a full assessment server-side and persists a scored, diagnosed session", async () => {
    const api = clientFor(userA);
    const repos = createRemoteRepos(api);
    const player = await repos.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });

    const outcome = await api.send<{
      sessionId: string;
      shots: { id: string }[];
      sessionScore: { overall: number | null };
      focusAreas: unknown[];
    }>("/api/analysis/session", {
      playerId: player.id,
      videos: [{ poseData }],
    });

    expect(outcome.shots.length).toBe(fixture.expectedShots);
    expect(outcome.sessionScore).toBeTruthy();

    // The session is completed and its shots/score are readable back by A.
    const session = await repos.session.get(outcome.sessionId);
    expect(session?.status).toBe("completed");
    const shots = await repos.shot.listBySession(outcome.sessionId);
    expect(shots.length).toBe(fixture.expectedShots);
    const score = await repos.score.latestForRef("session", outcome.sessionId);
    expect(score).toBeTruthy();

    // B cannot read A's session shots.
    const bShots = await createRemoteRepos(clientFor(userB)).shot.listBySession(
      outcome.sessionId,
    );
    expect(bShots).toEqual([]);
  });

  it("re-scores a session after an exclusion via /rescore", async () => {
    const api = clientFor(userA);
    const repos = createRemoteRepos(api);
    const player = await repos.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });
    const outcome = await api.send<{
      sessionId: string;
      shots: { id: string }[];
    }>("/api/analysis/session", {
      playerId: player.id,
      videos: [{ poseData }],
    });

    // Exclude the first shot, then re-score.
    await repos.shot.setExcluded(outcome.shots[0]!.id, true);
    const rescored = await api.send<{ sessionId: string; shots: unknown[] }>(
      `/api/sessions/${outcome.sessionId}/rescore`,
      {},
    );
    expect(rescored.sessionId).toBe(outcome.sessionId);
    expect(rescored.shots.length).toBe(outcome.shots.length - 1);

    // A stranger cannot re-score A's session.
    await expect(
      clientFor(userB).send(`/api/sessions/${outcome.sessionId}/rescore`, {}),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("analyzes a single live window against an existing session", async () => {
    const api = clientFor(userA);
    const repos = createRemoteRepos(api);
    const player = await repos.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });
    const session = await repos.session.create({
      playerId: player.id,
      type: "live_practice",
    });

    const result = await api.send<{ shots: { shot: { id: string } }[] }>(
      "/api/analysis/shot",
      { sessionId: session.id, playerId: player.id, poseData },
    );
    expect(result.shots.length).toBeGreaterThan(0);
    const shots = await repos.shot.listBySession(session.id);
    expect(shots.length).toBe(result.shots.length);
    // Each shot has a persisted shot-scope score.
    const score = await repos.score.latestForRef("shot", shots[0]!.id);
    expect(score).toBeTruthy();
  });

  it("rejects a stranger analyzing against another user's player", async () => {
    const a = createRemoteRepos(clientFor(userA));
    const player = await a.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });
    await expect(
      clientFor(userB).send("/api/analysis/session", {
        playerId: player.id,
        videos: [{ poseData }],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
