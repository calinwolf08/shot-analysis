import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDbSingletonForTests } from "$lib/server/db";
import { createApiClient } from "$lib/shared/api/client";
import { createRemoteRepos } from "$lib/shared/api/remote-repos";
import {
  inProcessFetch,
  type SessionUser,
} from "$lib/shared/api/__tests__/in-process-server";
import { createReplayAnalysisService } from "$lib/features/analysis/replay/replay-analysis-service";
import { createServerAssessmentService } from "../services/server-assessment-service";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(
  here,
  "..",
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
const loadFixture = async (id: string) =>
  JSON.parse(readFileSync(join(fixturesDir, `${id}.json`), "utf8"));

const dir = mkdtempSync(join(tmpdir(), "shotcoach-sassess-"));
const userA: SessionUser = { id: "user-a", email: "a@ex.com", name: "A" };

function build(user: SessionUser) {
  const api = createApiClient({
    fetch: inProcessFetch(user),
    baseUrl: "http://localhost",
  });
  const repos = createRemoteRepos(api);
  const analysis = createReplayAnalysisService({ loadFixture });
  const service = createServerAssessmentService({ analysis, repos, api });
  return { api, repos, service };
}

beforeAll(() => {
  process.env.DATABASE_PATH = join(dir, "sassess.sqlite");
});
afterAll(() => {
  delete process.env.DATABASE_PATH;
  resetDbSingletonForTests();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => resetDbSingletonForTests());

describe("server-backed AssessmentService (client extracts poses, server analyzes)", () => {
  it("runs an assessment: poses → server analysis → persisted scored session", async () => {
    const { repos, service } = build(userA);
    await repos.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });

    const progress: number[] = [];
    const outcome = await service.runAssessment(
      [{ input: { kind: "fixture", fixtureId: fixture.id }, name: fixture.id }],
      { onProgress: (p) => progress.push(p.videoIndex) },
    );

    expect(outcome.shots.length).toBe(fixture.expectedShots);
    expect(outcome.sessionScore).toBeTruthy();
    expect(progress.length).toBeGreaterThan(0);

    // Persisted + readable back through the remote repos.
    const session = await repos.session.get(outcome.sessionId);
    expect(session?.status).toBe("completed");
    expect((await repos.shot.listBySession(outcome.sessionId)).length).toBe(
      fixture.expectedShots,
    );
  });

  it("re-scores after excluding a shot in review", async () => {
    const { repos, service } = build(userA);
    await repos.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });
    const outcome = await service.runAssessment([
      { input: { kind: "fixture", fixtureId: fixture.id }, name: fixture.id },
    ]);

    await service.setShotExcluded(outcome.shots[0]!.id, true);
    const rescored = await service.rescoreSession(outcome.sessionId);
    expect(rescored.shots.length).toBe(outcome.shots.length - 1);
  });
});
