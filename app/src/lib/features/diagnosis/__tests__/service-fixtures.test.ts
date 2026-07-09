import { beforeEach, describe, expect, it } from "vitest";
import { builtInBenchmarks } from "$lib/features/benchmarks";
import { createReplayAnalysisService } from "$lib/features/analysis";
import { scoreRep, scoreSession } from "$lib/features/scoring";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import {
  createNodeFixtureLoader,
  FIXTURES,
} from "$lib/shared/testing/fixture-loader";
import { diagnose } from "../engine";
import { createDiagnosisService } from "../service";

const bench = builtInBenchmarks()[0]!;

describe("DiagnosisService", () => {
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
  });

  it("persists ranked focus areas and replaces on re-diagnosis", async () => {
    const analysis = await createReplayAnalysisService({
      loadFixture: createNodeFixtureLoader(),
    }).analyzeVideoFile(
      { kind: "fixture", fixtureId: FIXTURES.threeShots },
      { shootingHand: "right", profile: "pro-form" },
    );
    const reps = analysis.shots.map((s) => scoreRep(s, bench));
    const session = scoreSession(reps, analysis.shots, bench);

    const service = createDiagnosisService(services);
    const areas = await service.diagnoseAndPersist(
      sessionId,
      session,
      reps,
      bench,
    );
    expect(areas.length).toBeGreaterThanOrEqual(3);
    expect(areas.filter((a) => a.surfaced)).toHaveLength(3);

    const rows = await service.listForSession(sessionId);
    expect(rows).toHaveLength(areas.length);
    expect(rows[0]?.issueGroup).toBe(areas[0]?.issueGroup);
    expect(rows[0]?.rank).toBe(1);

    // Re-diagnose replaces, not appends.
    await service.diagnoseAndPersist(sessionId, session, reps, bench);
    expect(await service.listForSession(sessionId)).toHaveLength(areas.length);

    // Snapshot of the fixture diagnosis (group order + severities rounded).
    expect(
      areas.map((a) => ({
        group: a.issueGroup,
        severity: Number(a.severity.toFixed(3)),
        surfaced: a.surfaced,
      })),
    ).toMatchSnapshot();
  }, 60_000);

  it("diagnose is pure/deterministic over the fixture", async () => {
    const analysis = await createReplayAnalysisService({
      loadFixture: createNodeFixtureLoader(),
    }).analyzeVideoFile(
      { kind: "fixture", fixtureId: FIXTURES.singleShot },
      { shootingHand: "right", profile: "pro-form" },
    );
    const reps = analysis.shots.map((s) => scoreRep(s, bench));
    const session = scoreSession(reps, analysis.shots, bench);
    expect(diagnose(session, reps, bench)).toEqual(
      diagnose(session, reps, bench),
    );
  }, 60_000);
});
