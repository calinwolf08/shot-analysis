/**
 * Integration: every fixture shot scored against the placeholder benchmark.
 * Snapshot pins the exact numbers — replay + scoring are fully
 * deterministic, so any diff means formulas or pipeline changed.
 */
import { describe, expect, it } from "vitest";
import { builtInBenchmarks } from "$lib/features/benchmarks";
import { createReplayAnalysisService } from "$lib/features/analysis";
import {
  createNodeFixtureLoader,
  loadManifest,
} from "$lib/shared/testing/fixture-loader";
import { scoreRep } from "../engine";

const bench = builtInBenchmarks()[0]!;
const service = createReplayAnalysisService({
  loadFixture: createNodeFixtureLoader(),
});
const opts = { shootingHand: "right" as const, profile: "pro-form" };

describe("fixture rep scores vs placeholder benchmark", () => {
  it("scores every fixture shot inside (0, 100) and matches the snapshot", async () => {
    const summary: Record<string, { formScore: number; excluded: number }[]> =
      {};
    for (const fixture of loadManifest().fixtures) {
      const result = await service.analyzeVideoFile(
        { kind: "fixture", fixtureId: fixture.id },
        opts,
      );
      summary[fixture.id] = result.shots.map((shot) => {
        const rep = scoreRep(shot, bench);
        expect(rep.formScore).not.toBeNull();
        expect(rep.formScore!).toBeGreaterThan(0);
        expect(rep.formScore!).toBeLessThan(100);
        return {
          formScore: Number(rep.formScore!.toFixed(2)),
          excluded: rep.excludedMetrics.length,
        };
      });
    }
    expect(summary).toMatchSnapshot();
  }, 120_000);

  it("is stable across two scoring runs", async () => {
    const result = await service.analyzeVideoFile(
      { kind: "fixture", fixtureId: "20201212_134104" },
      opts,
    );
    const a = scoreRep(result.shots[0]!, bench);
    const b = scoreRep(result.shots[0]!, bench);
    expect(a).toEqual(b);
  }, 60_000);
});
