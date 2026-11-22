import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { PoseData } from "basketball-shot-analysis";
import { resetDbSingletonForTests, useDatabaseForTests } from "$lib/server/db";
import type { AppDatabase } from "$lib/server/database/kysely";
import {
  TEST_DATABASES,
  disposeTestDatabase,
} from "$lib/server/database/__tests__/dialects";
import { createApiClient } from "$lib/shared/api/client";
import { createRemoteRepos } from "$lib/shared/api/remote-repos";
import {
  inProcessFetch,
  type SessionUser,
} from "$lib/shared/api/__tests__/in-process-server";
import { profileForLevel } from "$lib/features/assessment";
import type { AnalyzeOptions } from "$lib/features/analysis";
import type { StoredShotAnalysis } from "$lib/features/analysis";
import type { LiveTargetsV3 } from "basketball-shot-analysis";
import { scoreStoredShot } from "../../review/scored-shots";
import type { ShotRecord } from "$lib/shared/db/repos";
import {
  createLocalPipeline,
  createServerPipeline,
  type ShotStore,
} from "../index";

const targets = JSON.parse(
  readFileSync(
    join(process.cwd(), "static", "reference", "live-targets-v3.json"),
    "utf8",
  ),
) as LiveTargetsV3;
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

    const { shots: result, rejected } = await pipeline.process({
      playerId: "p1",
      poseData: pose,
      opts,
    });
    expect(rejected).toEqual([]);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(saved.length).toBe(result.length); // one persist per detected shot
    expect(result[0]!.shot.playerId).toBe("p1");
    expect(result[0]!.shot.sessionId).toBeNull();
    expect(result[0]!.scorecard.phases).toHaveLength(4);
    expect(saved[0]!.v3Metrics).toBeDefined();
  });
});

/** SQLite on a real file (the server's own path), then each Postgres. */
const CASES: [string, (() => Promise<AppDatabase>) | null][] = [
  ["sqlite (file)", null],
  ...TEST_DATABASES.filter(([n]) => n.startsWith("postgres")),
];

describe.each(CASES)(
  "createServerPipeline (server analysis, end-to-end) [%s]",
  (_name, makePg) => {
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
    // Postgres: an in-process PGlite injected into the server singleton.
    let pg: AppDatabase | null = null;
    beforeEach(async () => {
      resetDbSingletonForTests();
      if (makePg) {
        pg = await makePg();
        useDatabaseForTests(pg);
      }
    });
    afterEach(async () => {
      if (pg) await disposeTestDatabase(pg);
      pg = null;
    });

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

      const { shots: result } = await pipeline.process({
        playerId: player.id,
        poseData: pose,
        opts, // ignored server-side (derived from the player there)
      });
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]!.scorecard.phases).toHaveLength(4);

      // Persisted player-rooted, with no session.
      const shots = await repos.shot.listByPlayer(player.id);
      expect(shots.length).toBe(result.length);
      expect(shots[0]!.sessionId).toBeNull();
      expect(shots[0]!.playerId).toBe(player.id);
    });

    it("read-time migration: a pre-v3 shot is recomputed from its pose track and saved", async () => {
      const api = createApiClient({
        fetch: inProcessFetch(userA),
        baseUrl: "http://localhost",
      });
      const repos = createRemoteRepos(api);
      const player = await repos.player.create({
        name: "Old",
        shootingHand: "right",
        level: "high-school",
      });
      await createServerPipeline({ api }).process({
        playerId: player.id,
        poseData: pose,
        opts,
      });
      const [live] = await repos.shot.listByPlayer(player.id);
      const v3 = (live!.analysis as StoredShotAnalysis).v3Metrics!;
      // Make it a schema-1 shot (as saved before v3), through the API.
      const { v3Metrics: _drop, ...v1 } = live!.analysis as StoredShotAnalysis;
      await repos.shot.updateAnalysis(live!.id, v1);
      const old = (await repos.shot.get(live!.id))!;
      expect((old.analysis as StoredShotAnalysis).v3Metrics).toBeUndefined();

      const scored = await scoreStoredShot(repos.shot, old, "right", targets);
      expect(scored.card).not.toBeNull();
      // Persisted: the next read is already v3 — and equals what live stored.
      const after = (await repos.shot.get(live!.id))!;
      const again = (after.analysis as StoredShotAnalysis).v3Metrics!;
      expect(again).toBeDefined();
      expect(again.metrics["setPoint.elbow_angle"]!.value).toBeCloseTo(
        v3.metrics["setPoint.elbow_angle"]!.value,
        6,
      );
    });

    it("rejects wrong-angle shots server-side without storing them", async () => {
      const api = createApiClient({
        fetch: inProcessFetch(userA),
        baseUrl: "http://localhost",
      });
      const repos = createRemoteRepos(api);
      // Left-handed: the side-right fixture is the guide-arm side for them.
      const player = await repos.player.create({
        name: "L",
        shootingHand: "left",
        level: "high-school",
      });
      const { shots, rejected } = await createServerPipeline({ api }).process({
        playerId: player.id,
        poseData: pose,
        opts,
      });
      expect(shots).toEqual([]);
      expect(rejected.length).toBeGreaterThanOrEqual(1);
      expect(await repos.shot.listByPlayer(player.id)).toEqual([]);
    });
  },
);
