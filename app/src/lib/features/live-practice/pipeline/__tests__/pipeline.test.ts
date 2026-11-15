import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PoseData } from "basketball-shot-analysis";
import { resetDbSingletonForTests } from "$lib/server/db";
import { createApiClient } from "$lib/shared/api/client";
import { createRemoteRepos } from "$lib/shared/api/remote-repos";
import {
  inProcessFetch,
  type SessionUser,
} from "$lib/shared/api/__tests__/in-process-server";
import { profileForLevel } from "$lib/features/assessment";
import type { AnalyzeOptions } from "$lib/features/analysis";
import type { StoredShotAnalysis } from "$lib/features/analysis";
import type { LiveTargets } from "$lib/features/scoring";
import type { ShotRecord } from "$lib/shared/db/repos";
import {
  createLocalPipeline,
  createServerPipeline,
  type ShotStore,
} from "../index";

const targets = JSON.parse(
  readFileSync(
    join(process.cwd(), "static", "reference", "live-targets.json"),
    "utf8",
  ),
) as LiveTargets;
const pose = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      "src-tests",
      "fixtures",
      "poses",
      "20201212_134104.json",
    ),
    "utf8",
  ),
) as PoseData;

const opts: AnalyzeOptions = {
  shootingHand: "right",
  profile: profileForLevel("high-school"),
};

describe("createLocalPipeline (on-device analysis)", () => {
  it("analyzes + scores on device and persists via the store", async () => {
    const saved: StoredShotAnalysis[] = [];
    const store: ShotStore = {
      async setExcluded() {},
      async save({ playerId, analysis }) {
        saved.push(analysis);
        return {
          id: `shot-${saved.length}`,
          playerId,
          sessionId: null,
          videoId: null,
          shotIndex: analysis.shotIndex,
          orientation: analysis.orientation ?? null,
          startFrame: analysis.frameRange.start,
          endFrame: analysis.frameRange.end,
          overallConfidence: analysis.overallConfidence,
          excluded: false,
          analysis,
          createdAt: 0,
        } satisfies ShotRecord;
      },
    };
    const pipeline = createLocalPipeline({ targets, store });
    expect(pipeline.location).toBe("device");

    const result = await pipeline.process({
      playerId: "p1",
      poseData: pose,
      opts,
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(saved.length).toBe(result.length); // one persist per detected shot
    expect(result[0]!.shot.playerId).toBe("p1");
    expect(result[0]!.shot.sessionId).toBeNull();
    expect(result[0]!.scorecard.sections).toHaveLength(2);
  });
});

describe("createServerPipeline (server analysis, end-to-end)", () => {
  const dir = mkdtempSync(join(tmpdir(), "shotcoach-pipeline-"));
  const userA: SessionUser = { id: "user-a", email: "a@ex.com", name: "A" };

  beforeAll(() => {
    process.env.DATABASE_PATH = join(dir, "pipeline.sqlite");
  });
  afterAll(() => {
    delete process.env.DATABASE_PATH;
    resetDbSingletonForTests();
    rmSync(dir, { recursive: true, force: true });
  });
  beforeEach(() => resetDbSingletonForTests());

  it("POSTs the window, analyzes + persists server-side, returns scorecards", async () => {
    const api = createApiClient({
      fetch: inProcessFetch(userA),
      baseUrl: "http://localhost",
    });
    const repos = createRemoteRepos(api);
    const player = await repos.player.create({
      name: "A",
      shootingHand: "right",
      level: "high-school",
    });

    const pipeline = createServerPipeline({ api });
    expect(pipeline.location).toBe("server");

    const result = await pipeline.process({
      playerId: player.id,
      poseData: pose,
      opts, // ignored server-side (derived from the player there)
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.scorecard.sections).toHaveLength(2);

    // Persisted player-rooted, with no session.
    const shots = await repos.shot.listByPlayer(player.id);
    expect(shots.length).toBe(result.length);
    expect(shots[0]!.sessionId).toBeNull();
    expect(shots[0]!.playerId).toBe(player.id);
  });
});
