import { describe, expect, it, vi } from "vitest";
import type { AnalysisResult } from "basketball-shot-analysis";
import type { LandmarkFrame } from "$lib/features/analysis";
import { createReplayAnalysisService } from "$lib/features/analysis";
import {
  createNodeFixtureLoader,
  FIXTURES,
} from "$lib/shared/testing/fixture-loader";
import {
  createLiveRepCoordinator,
  DEFAULT_LIVE_REP_CONFIG,
  type CoordinatorState,
  type LiveRepCoordinator,
} from "../coordinator/coordinator";
import {
  dribbleNoise,
  makeCursor,
  noPose,
  shotArc,
  stillPose,
} from "../coordinator/synthetic-streams";

const oneShot = { shots: [{}] } as unknown as AnalysisResult;
const noShots = { shots: [] } as unknown as AnalysisResult;

function harness(
  analyze: (frames: readonly LandmarkFrame[]) => Promise<AnalysisResult>,
  configOverrides: Record<string, unknown> = {},
) {
  const events = {
    stateChanged: [] as unknown[],
    repStarted: [] as unknown[],
    repAnalyzing: [] as unknown[],
    repResult: [] as unknown[],
    noShot: [] as unknown[],
    bufferStats: [] as unknown[],
  };
  const coordinator = createLiveRepCoordinator(
    { analyze },
    { shootingHand: "right", ...configOverrides },
  );
  for (const name of Object.keys(events) as (keyof typeof events)[]) {
    coordinator.on(
      name as never,
      ((payload: unknown) => {
        events[name].push(payload);
      }) as never,
    );
  }
  coordinator.start();
  return { coordinator, events };
}

function feed(coordinator: LiveRepCoordinator, frames: LandmarkFrame[]) {
  for (const frame of frames) coordinator.pushFrame(frame);
}

/** Feed that yields to in-flight analysis, auto-dismissing feedback. */
async function feedRealtime(
  coordinator: LiveRepCoordinator,
  frames: LandmarkFrame[],
) {
  for (const frame of frames) {
    coordinator.pushFrame(frame);
    if (coordinator.state === "ANALYZING") {
      await vi.waitFor(() => expect(coordinator.state).not.toBe("ANALYZING"));
    }
    if (coordinator.state === "FEEDBACK") coordinator.dismissFeedback();
  }
}

async function waitState(
  coordinator: LiveRepCoordinator,
  state: CoordinatorState,
) {
  await vi.waitFor(() => expect(coordinator.state).toBe(state));
}

describe("happy-path rep cycle", () => {
  it("IDLE → READY → ACTIVE → ANALYZING → FEEDBACK with a detected shot", async () => {
    const analyze = vi.fn().mockResolvedValue(oneShot);
    const { coordinator, events } = harness(analyze);
    const cursor = makeCursor();

    expect(coordinator.state).toBe("IDLE");
    feed(coordinator, stillPose(cursor, 1000));
    expect(coordinator.state).toBe("READY");

    feed(coordinator, shotArc(cursor));
    expect(coordinator.state).toBe("ACTIVE");
    expect(events.repStarted).toHaveLength(1);

    feed(coordinator, stillPose(cursor, 2000));
    await waitState(coordinator, "FEEDBACK");

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(events.repAnalyzing).toHaveLength(1);
    expect(events.repAnalyzing[0]).toMatchObject({ trigger: "settled" });
    expect(events.repResult).toHaveLength(1);
    const result = events.repResult[0] as {
      analysis: AnalysisResult;
      window: { frames: LandmarkFrame[]; startedAt: number };
    };
    expect(result.analysis.shots).toHaveLength(1);
    // Window includes pre-roll before the trigger.
    expect(result.window.frames[0]!.timestamp).toBeLessThan(
      result.window.startedAt,
    );

    coordinator.dismissFeedback();
    expect(coordinator.state).toBe("READY");
  });
});

describe("rep gap", () => {
  it("runs two back-to-back reps but ignores a trigger inside minRepGapMs", async () => {
    const analyze = vi.fn().mockResolvedValue(oneShot);
    const { coordinator, events } = harness(analyze);
    const cursor = makeCursor();

    feed(coordinator, stillPose(cursor, 1000));
    feed(coordinator, shotArc(cursor));
    feed(coordinator, stillPose(cursor, 1500));
    await waitState(coordinator, "FEEDBACK");
    coordinator.dismissFeedback();

    // An arc immediately after the rep falls inside the gap → ignored.
    feed(coordinator, shotArc(cursor));
    expect(coordinator.state).toBe("READY");
    expect(events.repStarted).toHaveLength(1);

    // After the gap passes, the next arc starts rep #2.
    feed(coordinator, stillPose(cursor, DEFAULT_LIVE_REP_CONFIG.minRepGapMs));
    feed(coordinator, shotArc(cursor));
    expect(coordinator.state).toBe("ACTIVE");
    feed(coordinator, stillPose(cursor, 1500));
    await waitState(coordinator, "FEEDBACK");

    expect(events.repStarted).toHaveLength(2);
    expect(events.repResult).toHaveLength(2);
  });
});

describe("no-shot windows", () => {
  it("dribble noise triggers a window but analysis says no shot → READY", async () => {
    const analyze = vi.fn().mockResolvedValue(noShots);
    const { coordinator, events } = harness(analyze);
    const cursor = makeCursor();

    feed(coordinator, stillPose(cursor, 1000));
    feed(coordinator, dribbleNoise(cursor, 2000));
    feed(coordinator, stillPose(cursor, 1500));
    await waitState(coordinator, "READY");

    expect(events.noShot).toHaveLength(1);
    expect(events.noShot[0]).toMatchObject({ reason: "no-shot-detected" });
    expect(events.repResult).toHaveLength(0);
  });

  it("treats an analysis failure as no shot", async () => {
    const analyze = vi.fn().mockRejectedValue(new Error("boom"));
    const { coordinator, events } = harness(analyze);
    const cursor = makeCursor();

    feed(coordinator, stillPose(cursor, 1000));
    feed(coordinator, shotArc(cursor));
    feed(coordinator, stillPose(cursor, 1500));
    await waitState(coordinator, "READY");

    expect(events.noShot).toHaveLength(1);
    expect(events.noShot[0]).toMatchObject({ reason: "analysis-failed" });
  });
});

describe("pose loss", () => {
  it("resets gracefully (no analysis) when the pose vanishes mid-rep", async () => {
    const analyze = vi.fn().mockResolvedValue(oneShot);
    const { coordinator, events } = harness(analyze);
    const cursor = makeCursor();

    feed(coordinator, stillPose(cursor, 1000));
    feed(coordinator, shotArc(cursor).slice(0, 8)); // mid-rise
    expect(coordinator.state).toBe("ACTIVE");

    feed(coordinator, noPose(cursor, 1500));
    expect(coordinator.state).toBe("IDLE");
    expect(analyze).not.toHaveBeenCalled();
    expect(events.repResult).toHaveLength(0);

    // Recovers: pose returns → READY again.
    feed(coordinator, stillPose(cursor, 1000));
    expect(coordinator.state).toBe("READY");
  });

  it("drops READY → IDLE when the pose stays gone", () => {
    const analyze = vi.fn().mockResolvedValue(oneShot);
    const { coordinator } = harness(analyze);
    const cursor = makeCursor();

    feed(coordinator, stillPose(cursor, 1000));
    expect(coordinator.state).toBe("READY");
    feed(coordinator, noPose(cursor, 1500));
    expect(coordinator.state).toBe("IDLE");
  });

  it("discards velocity across a long timestamp gap (pose dropout)", () => {
    const analyze = vi.fn().mockResolvedValue(oneShot);
    const { coordinator, events } = harness(analyze);
    const cursor = makeCursor();

    feed(coordinator, stillPose(cursor, 1000));
    // The stream stalls for a second; the next frame teleports the wrist
    // upward. The dt guard must zero the derivative instead of reading it
    // as an explosive rise.
    cursor.timestamp += 1000;
    feed(coordinator, stillPose(cursor, 33).slice(0, 1));
    expect(coordinator.state).toBe("READY");
    expect(events.repStarted).toHaveLength(0);
  });
});

describe("buffer", () => {
  it("never exceeds the buffer cap over a long stream", () => {
    const analyze = vi.fn().mockResolvedValue(noShots);
    const { coordinator, events } = harness(analyze);
    const cursor = makeCursor();

    feed(coordinator, stillPose(cursor, 30_000));

    expect(events.bufferStats.length).toBeGreaterThan(0);
    for (const stats of events.bufferStats as {
      frames: number;
      spanMs: number;
    }[]) {
      expect(stats.spanMs).toBeLessThanOrEqual(
        DEFAULT_LIVE_REP_CONFIG.bufferMs,
      );
    }
  });
});

describe("max rep duration", () => {
  it("forces analysis when motion never settles", async () => {
    const analyze = vi.fn().mockResolvedValue(oneShot);
    const { coordinator, events } = harness(analyze);
    const cursor = makeCursor();

    feed(coordinator, stillPose(cursor, 1000));
    // Continuous dribble-like motion: triggers ACTIVE and never settles.
    feed(coordinator, dribbleNoise(cursor, 8000));
    await waitState(coordinator, "FEEDBACK");

    expect(events.repAnalyzing).toHaveLength(1);
    expect(events.repAnalyzing[0]).toMatchObject({ trigger: "max-duration" });
  });
});

describe("stop", () => {
  it("voids an in-flight analysis and returns to IDLE", async () => {
    let resolveAnalysis!: (r: AnalysisResult) => void;
    const analyze = vi
      .fn()
      .mockReturnValue(
        new Promise<AnalysisResult>((res) => (resolveAnalysis = res)),
      );
    const { coordinator, events } = harness(analyze);
    const cursor = makeCursor();

    feed(coordinator, stillPose(cursor, 1000));
    feed(coordinator, shotArc(cursor));
    feed(coordinator, stillPose(cursor, 1500));
    expect(coordinator.state).toBe("ANALYZING");

    coordinator.stop();
    expect(coordinator.state).toBe("IDLE");
    resolveAnalysis(oneShot);
    await Promise.resolve();
    await Promise.resolve();
    expect(events.repResult).toHaveLength(0);
    expect(events.noShot).toHaveLength(0);
  });
});

describe("edge inputs", () => {
  it("ignores frames pushed before start()", () => {
    const analyze = vi.fn().mockResolvedValue(oneShot);
    const coordinator = createLiveRepCoordinator(
      { analyze },
      { shootingHand: "right" },
    );
    const cursor = makeCursor();
    for (const frame of stillPose(cursor, 1000)) coordinator.pushFrame(frame);
    expect(coordinator.state).toBe("IDLE");
  });

  it("swallows a stale analysis rejection after stop()", async () => {
    let rejectAnalysis!: (e: Error) => void;
    const analyze = vi
      .fn()
      .mockReturnValue(
        new Promise<AnalysisResult>((_res, rej) => (rejectAnalysis = rej)),
      );
    const { coordinator, events } = harness(analyze);
    const cursor = makeCursor();

    feed(coordinator, stillPose(cursor, 1000));
    feed(coordinator, shotArc(cursor));
    feed(coordinator, stillPose(cursor, 1500));
    expect(coordinator.state).toBe("ANALYZING");

    coordinator.stop();
    rejectAnalysis(new Error("late failure"));
    await Promise.resolve();
    await Promise.resolve();
    expect(events.noShot).toHaveLength(0);
  });

  it("tracks nothing when the wrist landmark is missing", () => {
    const analyze = vi.fn().mockResolvedValue(oneShot);
    const { coordinator, events } = harness(analyze);
    const cursor = makeCursor();

    // Pose detected but truncated below the wrists (occluded arms).
    const armless = stillPose(cursor, 1000).map((f) => ({
      ...f,
      landmarks: f.landmarks!.slice(0, 15),
    }));
    feed(coordinator, armless);
    expect(coordinator.state).toBe("READY");
    expect(events.repStarted).toHaveLength(0);
  });
});

describe("real fixture segment through the replay pipeline", () => {
  it("produces an actual RepResult with a detected shot", async () => {
    const replay = createReplayAnalysisService({
      loadFixture: createNodeFixtureLoader(),
      liveFixtureId: FIXTURES.singleShot,
      schedule: (cb) => {
        cb();
        return () => {};
      },
    });
    const session = replay.createLiveSession({
      shootingHand: "right",
      profile: "pro-form",
    });
    const frames: LandmarkFrame[] = [];
    session.onFrame((f) => frames.push(f));
    await session.start();
    expect(frames.length).toBeGreaterThan(30);

    // Extend the stream with stillness (last real pose held) so the final
    // motion settles even if the recording cuts right after the shot.
    const lastPosed = [...frames].reverse().find((f) => f.landmarks !== null)!;
    const msPerFrame = frames[1]!.timestamp - frames[0]!.timestamp;
    const tail: LandmarkFrame[] = [];
    for (let i = 1; i <= Math.ceil(2500 / msPerFrame); i++) {
      tail.push({
        ...lastPosed,
        frameIndex: frames.at(-1)!.frameIndex + i,
        timestamp: frames.at(-1)!.timestamp + i * msPerFrame,
      });
    }

    const { coordinator, events } = harness(
      (window) => session.analyzeWindow(window),
      // The recording is one continuous take; disable the inter-rep gap so
      // an early false window can't swallow the real shot.
      { minRepGapMs: 0 },
    );
    await feedRealtime(coordinator, [...frames, ...tail]);

    const results = events.repResult as { analysis: AnalysisResult }[];
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]!.analysis.shots.length).toBeGreaterThanOrEqual(1);
    const shot = results[0]!.analysis.shots[0]!;
    expect(Object.keys(shot.metrics).length).toBeGreaterThan(0);
  }, 30_000);
});
