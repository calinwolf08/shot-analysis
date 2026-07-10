import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_BENCHMARK_ID } from "$lib/features/benchmarks";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import { makeShotAnalysis } from "$lib/shared/testing/fixtures";

const DAY = 86_400_000;
/** Deterministic "today" for streak math (some day at 15:00 UTC). */
const TODAY_3PM = 1_000 * DAY + 15 * 3_600_000;

let services: TestServices;
let playerId: string;

/**
 * Seeds a realistic 6-session history: alternating assessment / live
 * sessions on days −5 … 0 relative to TODAY_3PM, each with two shots
 * (kneeFlexion drifting toward ideal) and a session score.
 */
async function seedHistory() {
  const benchmark = await services.benchmarks.getActive();
  for (let i = 0; i < 6; i++) {
    const dayOffset = 5 - i; // oldest first
    services.clock.set(TODAY_3PM - dayOffset * DAY);
    const session = await services.repos.session.create({
      playerId,
      type: i % 2 === 0 ? "assessment" : "live_practice",
    });
    for (let shot = 0; shot < 2; shot++) {
      await services.repos.shot.saveAnalysis({
        sessionId: session.id,
        analysis: makeShotAnalysis({
          shotIndex: shot,
          metrics: {
            // Drifts 25 → 45 (the ideal) across the six sessions.
            kneeFlexion: { value: 25 + i * 4 + shot * 2, confidence: 0.9 },
          },
        }),
      });
    }
    await services.repos.session.complete(session.id);
    await services.scoring.scoreAndPersistSession(session.id, benchmark);
  }
  services.clock.set(TODAY_3PM);
}

beforeEach(async () => {
  services = await createTestServices();
  await services.benchmarks.seed();
  const player = await services.repos.player.create({
    name: "Progress",
    shootingHand: "right",
    level: "high-school",
  });
  playerId = player.id;
  await seedHistory();
});

describe("scoreHistory", () => {
  it("returns completed sessions chronologically with their latest scores", async () => {
    const history = await services.progress.scoreHistory(playerId);
    expect(history).toHaveLength(6);
    for (let i = 1; i < history.length; i++) {
      expect(history[i]!.completedAt).toBeGreaterThan(
        history[i - 1]!.completedAt,
      );
    }
    expect(history.map((h) => h.type)).toEqual([
      "assessment",
      "live_practice",
      "assessment",
      "live_practice",
      "assessment",
      "live_practice",
    ]);
    for (const point of history) {
      expect(point.formScore).not.toBeNull();
    }
  });

  it("uses the most recent score row when a session was re-scored", async () => {
    const history = await services.progress.scoreHistory(playerId);
    const target = history[0]!;
    const before = target.formScore;

    // Re-score later (e.g. after an exclusion) — history must follow.
    services.clock.advance(60_000);
    await services.repos.score.insert({
      scope: "session",
      refId: target.sessionId,
      benchmarkId: DEFAULT_BENCHMARK_ID,
      scoringVersion: 1,
      formScore: 99,
      consistencyScore: null,
      efficiencyScore: null,
      overallScore: 99,
      breakdown: {},
    });
    const updated = await services.progress.scoreHistory(playerId);
    expect(updated).toHaveLength(6);
    expect(updated[0]!.formScore).toBe(99);
    expect(updated[0]!.formScore).not.toBe(before);
  });

  it("ignores sessions that never completed", async () => {
    await services.repos.session.create({ playerId, type: "live_practice" });
    const history = await services.progress.scoreHistory(playerId);
    expect(history).toHaveLength(6);
  });
});

describe("metricTrend", () => {
  it("computes per-session mean ± σ for the metric, chronologically", async () => {
    const trend = await services.progress.metricTrend(playerId, "kneeFlexion");
    expect(trend).toHaveLength(6);
    // Session i has shots at value 25+4i and 27+4i → mean 26+4i, σ = 1.
    trend.forEach((point, i) => {
      expect(point.n).toBe(2);
      expect(point.mean).toBeCloseTo(26 + i * 4, 5);
      expect(point.std).toBeCloseTo(1, 5);
    });
    // Chronological: means strictly increase with the seeded drift.
    for (let i = 1; i < trend.length; i++) {
      expect(trend[i]!.mean).toBeGreaterThan(trend[i - 1]!.mean);
    }
  });

  it("skips excluded shots and unmeasured metrics", async () => {
    const history = await services.progress.scoreHistory(playerId);
    const shots = await services.repos.shot.listBySession(
      history[0]!.sessionId,
    );
    await services.repos.shot.setExcluded(shots[0]!.id, true);

    const trend = await services.progress.metricTrend(playerId, "kneeFlexion");
    expect(trend[0]!.n).toBe(1);
    expect(trend[0]!.std).toBe(0);

    const none = await services.progress.metricTrend(
      playerId,
      "guideHandRelease", // not in the seeded metric set
    );
    expect(none).toHaveLength(0);
  });
});

describe("totals", () => {
  it("counts sessions, assessments, shots, and the current streak", async () => {
    const totals = await services.progress.totals(playerId);
    expect(totals.sessions).toBe(6);
    expect(totals.assessments).toBe(3);
    expect(totals.repsAnalyzed).toBe(12);
    expect(totals.streakDays).toBe(6); // practiced every day incl. today
  });

  it("streak survives a missing today but breaks on a skipped day", async () => {
    // Move "now" one day forward: last practice was yesterday → streak holds.
    services.clock.set(TODAY_3PM + DAY);
    expect((await services.progress.totals(playerId)).streakDays).toBe(6);

    // Two days later the chain is broken.
    services.clock.set(TODAY_3PM + 2 * DAY);
    expect((await services.progress.totals(playerId)).streakDays).toBe(0);
  });

  it("is empty for a fresh player", async () => {
    const fresh = await services.repos.player.create({
      name: "Fresh",
      shootingHand: "left",
      level: "youth",
    });
    const totals = await services.progress.totals(fresh.id);
    expect(totals).toEqual({
      sessions: 0,
      assessments: 0,
      repsAnalyzed: 0,
      streakDays: 0,
    });
  });
});
