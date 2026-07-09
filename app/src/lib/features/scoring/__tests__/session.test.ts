import { describe, expect, it } from "vitest";
import { builtInBenchmarks } from "$lib/features/benchmarks";
import { makeShotAnalysis } from "$lib/shared/testing/fixtures";
import type { ShotAnalysis } from "basketball-shot-analysis";
import { scoreRep } from "../engine";
import {
  consistencyCurve,
  DEFAULT_SESSION_WEIGHTS,
  EFFICIENCY_METRICS,
  scoreSession,
} from "../session";

const bench = builtInBenchmarks()[0]!;

/** A decent shot with metrics covering pass/warning + efficiency subset. */
function makeShot(
  overrides: Record<string, number | string> = {},
): ShotAnalysis {
  const metrics: Record<
    string,
    { value: number | string; confidence: number }
  > = {
    shootingElbowAngle: { value: 90, confidence: 0.9 },
    shootingElbowFlare: { value: 10, confidence: 0.9 },
    kneeFlexion: { value: 45, confidence: 0.9 },
    headTilt: { value: 1, confidence: 0.9 },
    ballDip: { value: 0.12, confidence: 0.8 },
    ballPath: { value: 0.05, confidence: 0.8 },
    totalShotDuration: { value: 800, confidence: 0.95 },
    ballLegSync: { value: 0, confidence: 0.8 },
  };
  for (const [k, v] of Object.entries(overrides)) {
    metrics[k] = { value: v, confidence: 0.9 };
  }
  return makeShotAnalysis({ metrics });
}

function repsFor(shots: ShotAnalysis[]) {
  return shots.map((s) => scoreRep(s, bench));
}

describe("consistencyCurve calibration", () => {
  it("maps CV 0.05 → ≈0.95 and CV 0.25 → ≈0.55 (design calibration)", () => {
    expect(consistencyCurve(0.05)).toBeGreaterThan(0.93);
    expect(consistencyCurve(0.05)).toBeLessThan(0.97);
    expect(consistencyCurve(0.25)).toBeGreaterThan(0.53);
    expect(consistencyCurve(0.25)).toBeLessThan(0.57);
    expect(consistencyCurve(0)).toBe(1);
  });

  it("is monotonically decreasing in CV", () => {
    let prev = 1.1;
    for (let cv = 0; cv < 1; cv += 0.01) {
      const s = consistencyCurve(cv);
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });
});

describe("scoreSession", () => {
  it("identical reps → consistency ≈ 100", () => {
    const shots = [makeShot(), makeShot(), makeShot(), makeShot()];
    const session = scoreSession(repsFor(shots), shots, bench);
    expect(session.consistency).not.toBeNull();
    expect(session.consistency!).toBeGreaterThan(99.5);
  });

  it("injected variance lowers consistency monotonically", () => {
    const spreads = [0, 4, 10, 20];
    let prev = 101;
    for (const spread of spreads) {
      const shots = [
        makeShot({ shootingElbowAngle: 90 - spread }),
        makeShot({ shootingElbowAngle: 90 - spread / 2 }),
        makeShot({ shootingElbowAngle: 90 + spread / 2 }),
        makeShot({ shootingElbowAngle: 90 + spread }),
      ];
      const session = scoreSession(repsFor(shots), shots, bench);
      expect(session.consistency!).toBeLessThanOrEqual(prev);
      prev = session.consistency!;
    }
    expect(prev).toBeLessThan(99);
  });

  it("N=2 → consistency null and overall re-weighted over form+efficiency", () => {
    const shots = [makeShot(), makeShot()];
    const session = scoreSession(repsFor(shots), shots, bench);
    expect(session.consistency).toBeNull();
    expect(session.form).not.toBeNull();
    expect(session.efficiency).not.toBeNull();
    const expected =
      (session.form! * DEFAULT_SESSION_WEIGHTS.form +
        session.efficiency! * DEFAULT_SESSION_WEIGHTS.efficiency) /
      (DEFAULT_SESSION_WEIGHTS.form + DEFAULT_SESSION_WEIGHTS.efficiency);
    expect(session.overall).toBeCloseTo(expected, 8);
    expect(session.breakdown.appliedWeights.consistency).toBe(0);
  });

  it("efficiency uses only the movement-economy subset", () => {
    const base = [makeShot(), makeShot(), makeShot()];
    const baseline = scoreSession(repsFor(base), base, bench);

    // Wreck a NON-subset metric → efficiency unchanged.
    const wreckedPosture = base.map(() => makeShot({ headTilt: 40 }));
    const posture = scoreSession(
      repsFor(wreckedPosture),
      wreckedPosture,
      bench,
    );
    expect(posture.efficiency).toBeCloseTo(baseline.efficiency!, 8);
    expect(posture.form!).toBeLessThan(baseline.form!);

    // Wreck a subset metric → efficiency drops.
    const wreckedPath = base.map(() => makeShot({ ballPath: 0.9 }));
    const path = scoreSession(repsFor(wreckedPath), wreckedPath, bench);
    expect(path.efficiency!).toBeLessThan(baseline.efficiency!);
  });

  it("records the efficiency metrics actually used", () => {
    const shots = [makeShot()];
    const session = scoreSession(repsFor(shots), shots, bench);
    for (const m of session.breakdown.efficiencyMetricsUsed) {
      expect(EFFICIENCY_METRICS).toContain(m);
    }
    expect(session.breakdown.efficiencyMetricsUsed).toContain("ballPath");
  });

  it("uses a trimmed mean for form when N ≥ 8", () => {
    // 7 identical good reps + 1 disaster rep.
    const good = Array.from({ length: 7 }, () => makeShot());
    const bad = makeShot({
      shootingElbowAngle: 140,
      kneeFlexion: 170,
      headTilt: 40,
      ballPath: 0.9,
    });
    const shots8 = [...good, bad];
    const session8 = scoreSession(repsFor(shots8), shots8, bench);
    expect(session8.breakdown.trimmed).toBe(true);

    // Trimmed: the outlier (and one best) dropped → form equals the good-rep score.
    const goodOnly = scoreSession(repsFor(good), good, bench);
    expect(session8.form).toBeCloseTo(goodOnly.form!, 6);

    // With only 7 reps (below threshold) the outlier drags the mean down.
    const shots7 = [...good.slice(0, 6), bad];
    const session7 = scoreSession(repsFor(shots7), shots7, bench);
    expect(session7.breakdown.trimmed).toBe(false);
    expect(session7.form!).toBeLessThan(goodOnly.form!);
  });

  it("returns all-null scores for an empty session", () => {
    const session = scoreSession([], [], bench);
    expect(session.form).toBeNull();
    expect(session.consistency).toBeNull();
    expect(session.efficiency).toBeNull();
    expect(session.overall).toBeNull();
  });

  it("keeps scores in [0, 100] and stamps version + benchmark", () => {
    const shots = [makeShot(), makeShot({ shootingElbowAngle: 70 })];
    const session = scoreSession(repsFor(shots), shots, bench);
    for (const v of [session.form, session.efficiency, session.overall]) {
      expect(v).not.toBeNull();
      expect(v!).toBeGreaterThanOrEqual(0);
      expect(v!).toBeLessThanOrEqual(100);
    }
    expect(session.scoringVersion).toBe(1);
    expect(session.breakdown.benchmarkId).toBe(bench.id);
  });
});
