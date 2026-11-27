import { describe, expect, it } from "vitest";
import { createLatencyLog, stats } from "../latency-log";

describe("latency log", () => {
  it("times each step from the shot's start and summarizes scored shots", () => {
    let t = 1000;
    const log = createLatencyLog(() => t);
    // A false trigger: no shot.
    log.repStarted();
    t += 600;
    log.repEnded("released");
    t += 50;
    log.scored("no-shot");
    // Two shots.
    for (const spoken of [3000, 3400]) {
      t += 5000;
      const start = t;
      log.repStarted();
      t = start + 700;
      log.repEnded("released");
      t = start + 2900;
      log.refined({
        ok: true,
        ms: 2200,
        frames: 64,
        posed: 64,
        liveFrames: 40,
        fps: 30,
        source: "cache",
        earlyFrames: 30,
        framesMs: 3,
      });
      t = start + 2950;
      log.scored("scored");
      t = start + spoken;
      log.spoken("At release: hands too low by 4.");
    }
    expect(log.shots).toHaveLength(3);
    expect(log.shots[0]).toMatchObject({
      rep: 1,
      outcome: "no-shot",
      repEndMs: 600,
    });
    expect(log.shots[2]).toMatchObject({
      rep: 3,
      outcome: "scored",
      trigger: "released",
      repEndMs: 700,
      refinedMs: 2900,
      scoredMs: 2950,
      spokenMs: 3400,
      refine: { source: "cache", earlyFrames: 30, frames: 64 },
      readback: "At release: hands too low by 4.",
    });
    const s = log.summary();
    expect(s).toMatchObject({ reps: 3, scored: 2 });
    expect(s.shotToSpokenMs).toEqual({
      median: 3200,
      mean: 3200,
      min: 3000,
      max: 3400,
      n: 2,
    });
  });

  it("stats: median of an even count is the mean of the middle two", () => {
    expect(stats([4, 1, 3, 2])!.median).toBe(3); // 2.5, rounded
    expect(stats([])).toBeNull();
  });
});
