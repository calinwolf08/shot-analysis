import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import {
  builtInBenchmarks,
  createBenchmarkService,
  type BenchmarkProfile,
} from "$lib/features/benchmarks";
import { makeShotAnalysis } from "$lib/shared/testing/fixtures";
import { createScoringService } from "../service";

const bench = builtInBenchmarks()[0]!;

describe("ScoringService persistence", () => {
  let services: TestServices;
  let sessionId: string;

  beforeEach(async () => {
    services = await createTestServices();
    const player = await services.repos.player.create({
      name: "A",
      shootingHand: "right",
      level: "youth",
    });
    sessionId = (
      await services.repos.session.create({
        playerId: player.id,
        type: "assessment",
      })
    ).id;
    // Seed the benchmark so scores.benchmark_id FK resolves.
    await createBenchmarkService(services, {
      settings: services.repos.settings,
    }).seed();
  });

  function makeService() {
    return createScoringService(services, {
      shotRepo: services.repos.shot,
      scoreRepo: services.repos.score,
    });
  }

  it("scoreAndPersistShot writes a shot-scope row with the RepScore breakdown", async () => {
    const shot = await services.repos.shot.saveAnalysis({
      sessionId,
      analysis: makeShotAnalysis(),
    });
    const scored = await makeService().scoreAndPersistShot(shot, bench);
    expect(scored.repScore.formScore).not.toBeNull();

    const row = await services.repos.score.latestForRef("shot", shot.id);
    expect(row?.formScore).toBeCloseTo(scored.repScore.formScore!, 6);
    expect(row?.scoringVersion).toBe(1);
    expect(row?.benchmarkId).toBe(bench.id);
    expect((row?.breakdown as { formScore: number }).formScore).toBeCloseTo(
      scored.repScore.formScore!,
      6,
    );
  });

  it("scoreAndPersistSession writes shot rows + a session row (excluded shots ignored)", async () => {
    for (let i = 0; i < 3; i++) {
      await services.repos.shot.saveAnalysis({
        sessionId,
        analysis: makeShotAnalysis({ shotIndex: i }),
      });
    }
    const excluded = await services.repos.shot.saveAnalysis({
      sessionId,
      analysis: makeShotAnalysis({ shotIndex: 3 }),
    });
    await services.repos.shot.setExcluded(excluded.id, true);

    const { session, shots } = await makeService().scoreAndPersistSession(
      sessionId,
      bench,
    );
    expect(shots).toHaveLength(3); // excluded shot not scored

    const sessionRow = await services.repos.score.latestForRef(
      "session",
      sessionId,
    );
    expect(sessionRow?.overallScore).toBeCloseTo(session.overall!, 6);
    expect(sessionRow?.consistencyScore).toBeCloseTo(session.consistency!, 6);
    const shotRows = await services.db.query(
      "SELECT * FROM scores WHERE scope = 'shot'",
    );
    expect(shotRows).toHaveLength(3);
  });

  it("re-scoring with a new benchmark version preserves history", async () => {
    await services.repos.shot.saveAnalysis({
      sessionId,
      analysis: makeShotAnalysis(),
    });
    const service = makeService();
    await service.scoreAndPersistSession(sessionId, bench);

    const bench2: BenchmarkProfile = { ...bench, id: "bench-v2", version: 2 };
    await services.db.run(
      `INSERT INTO benchmarks (id, name, version, is_placeholder, data_json, created_at)
       VALUES ('bench-v2', 'v2', 2, 1, '{}', 0)`,
    );
    services.clock.advance(1000);
    await service.scoreAndPersistSession(sessionId, bench2);

    const history = await services.repos.score.listForRef("session", sessionId);
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.benchmarkId)).toEqual([bench.id, "bench-v2"]);
    const latest = await services.repos.score.latestForRef(
      "session",
      sessionId,
    );
    expect(latest?.benchmarkId).toBe("bench-v2");
  });
});
