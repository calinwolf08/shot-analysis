import { beforeEach, describe, expect, it } from "vitest";
import { createReplayAnalysisService } from "$lib/features/analysis";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import {
  createNodeFixtureLoader,
  loadManifest,
} from "$lib/shared/testing/fixture-loader";
import {
  AssessmentAbortedError,
  type AssessmentProgress,
} from "../services/assessment-service";

let services: TestServices;

beforeEach(async () => {
  services = await createTestServices({
    analysis: createReplayAnalysisService({
      loadFixture: createNodeFixtureLoader(),
    }),
  });
  await services.benchmarks.seed();
  await services.repos.player.create({
    name: "A",
    shootingHand: "right",
    level: "advanced",
  });
});

describe("AssessmentService.runAssessment (fixtures end-to-end)", () => {
  it("persists a consistent session/shots/metrics/scores/focus-areas graph", async () => {
    const manifest = loadManifest();
    const inputs = manifest.fixtures.map((f) => ({
      input: { kind: "fixture" as const, fixtureId: f.id },
      name: f.id,
    }));
    const progress: AssessmentProgress[] = [];

    const outcome = await services.assessment.runAssessment(inputs, {
      onProgress: (p) => progress.push(p),
    });

    const expectedShots = manifest.fixtures.reduce(
      (s, f) => s + f.expectedShots,
      0,
    );
    expect(outcome.shots).toHaveLength(expectedShots);
    expect(outcome.sessionScore.overall).toBeGreaterThan(0);
    expect(outcome.focusAreas.length).toBeGreaterThanOrEqual(3);

    // Session row completed.
    const session = await services.repos.session.get(outcome.sessionId);
    expect(session?.status).toBe("completed");
    expect(session?.completedAt).not.toBeNull();

    // Videos: one per input.
    const videos = await services.db.query("SELECT id FROM videos");
    expect(videos).toHaveLength(inputs.length);

    // shots ↔ shot_metrics consistency.
    const shotRows = await services.db.query<{ id: string }>(
      "SELECT id FROM shots WHERE session_id = ?",
      [outcome.sessionId],
    );
    expect(shotRows).toHaveLength(expectedShots);
    for (const row of shotRows) {
      const metrics = await services.db.query(
        "SELECT metric_name FROM shot_metrics WHERE shot_id = ?",
        [row.id],
      );
      expect(metrics.length).toBeGreaterThanOrEqual(15);
    }

    // Scores: one per shot + one session-scope.
    const shotScores = await services.db.query(
      "SELECT id FROM scores WHERE scope = 'shot'",
    );
    expect(shotScores).toHaveLength(expectedShots);
    const sessionScore = await services.repos.score.latestForRef(
      "session",
      outcome.sessionId,
    );
    expect(sessionScore?.overallScore).toBeCloseTo(
      outcome.sessionScore.overall!,
      6,
    );

    // Focus areas persisted with ranks 1..N.
    const areas = await services.diagnosis.listForSession(outcome.sessionId);
    expect(areas.map((a) => a.rank)).toEqual(areas.map((_, i) => i + 1));

    // Progress covered all videos.
    expect(new Set(progress.map((p) => p.videoIndex)).size).toBe(inputs.length);
    expect(progress.at(-1)?.totalShotsDetected).toBe(expectedShots);
  }, 120_000);

  it("excluding a shot and re-scoring changes the session score", async () => {
    const outcome = await services.assessment.runAssessment([
      {
        input: { kind: "fixture", fixtureId: loadManifest().fixtures[1]!.id },
        name: "three",
      },
    ]);
    const before = outcome.sessionScore.overall!;

    // Exclude the worst-scoring shot to guarantee a change.
    const scores = await Promise.all(
      outcome.shots.map(async (s) => ({
        shot: s,
        score: (await services.repos.score.latestForRef("shot", s.id))
          ?.formScore,
      })),
    );
    scores.sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
    await services.assessment.setShotExcluded(scores[0]!.shot.id, true);

    const rescored = await services.assessment.rescoreSession(
      outcome.sessionId,
    );
    expect(rescored.shots).toHaveLength(outcome.shots.length - 1);
    expect(rescored.sessionScore.overall).not.toBeCloseTo(before, 4);
  }, 120_000);

  it("cancellation aborts the session row", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      services.assessment.runAssessment(
        [
          {
            input: { kind: "fixture", fixtureId: "20201212_134104" },
            name: "single",
          },
        ],
        { signal: controller.signal },
      ),
    ).rejects.toThrow(AssessmentAbortedError);

    const sessions = await services.db.query<{ status: string }>(
      "SELECT status FROM sessions",
    );
    expect(sessions[0]?.status).toBe("aborted");
  }, 60_000);
});
