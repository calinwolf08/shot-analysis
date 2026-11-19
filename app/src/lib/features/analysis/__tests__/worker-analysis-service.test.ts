import { describe, expect, it, vi } from "vitest";
import type { FrameProvider, VideoFrame } from "basketball-shot-analysis";
import type { AnalysisProgress } from "../types";
import {
  AnalysisCancelledError,
  AnalysisWorkerError,
  createWorkerAnalysisService,
  type WorkerLike,
} from "../services/worker-analysis-service";
import type { ToWorkerMessage } from "../worker/worker-protocol";

/**
 * FakeWorker: scriptable worker double implementing the protocol from the
 * worker side. `behavior` decides what to send back per received message.
 */
function makeFakeWorker(
  behavior: (message: ToWorkerMessage, reply: (data: unknown) => void) => void,
) {
  const received: ToWorkerMessage[] = [];
  let listener: ((event: { data: unknown }) => void) | null = null;
  let terminated = false;

  const worker: WorkerLike = {
    postMessage(message: unknown) {
      const m = message as ToWorkerMessage;
      received.push(m);
      // Simulate async worker replies.
      queueMicrotask(() => {
        if (terminated) return;
        behavior(m, (data) => listener?.({ data }));
      });
    },
    addEventListener(type, cb) {
      if (type === "message") {
        listener = cb as unknown as (event: { data: unknown }) => void;
      }
    },
    terminate() {
      terminated = true;
    },
  };
  return {
    worker,
    received,
    get terminated() {
      return terminated;
    },
  };
}

function makeFakeProvider(
  frameCount: number,
  durationMs?: number,
): FrameProvider {
  let i = 0;
  return {
    async getNextFrame(): Promise<VideoFrame | null> {
      if (i >= frameCount) return null;
      const frame: VideoFrame = {
        data: new Uint8ClampedArray([i, 0, 0, 255]),
        width: 1,
        height: 1,
        timestamp: i * 33.3,
        frameIndex: i,
      };
      i += 1;
      return frame;
    },
    getFps: () => 30,
    getMetadata: () => ({
      width: 1,
      height: 1,
      ...(durationMs !== undefined ? { duration: durationMs } : {}),
    }),
  };
}

const opts = { shootingHand: "right" as const, profile: "pro-form" };

const happyBehavior = (
  message: ToWorkerMessage,
  reply: (data: unknown) => void,
) => {
  if (message.type === "init") reply({ type: "ready" });
  if (message.type === "frames") {
    reply({
      type: "progress",
      progress: {
        framesProcessed: message.frames.length,
        shotsDetected: 0,
        phase: "detecting",
      },
    });
  }
  if (message.type === "finalize") {
    reply({
      type: "result",
      result: {
        shots: [{ shotIndex: 0 }],
        videoMetadata: { fps: 30, totalFrames: 7, duration: 0.23 },
        config: {},
      },
    });
  }
};

describe("WorkerAnalysisService.analyzeVideoFile (mocked worker)", () => {
  it("runs init → frames → finalize and returns the result", async () => {
    const fake = makeFakeWorker(happyBehavior);
    const service = createWorkerAnalysisService({
      makeWorker: () => fake.worker,
      makeFrameProvider: async () => makeFakeProvider(7),
      batchSize: 3,
    });

    const progress: AnalysisProgress[] = [];
    const result = await service.analyzeVideoFile(new Blob(["v"]), opts, (p) =>
      progress.push(p),
    );

    expect(result.shots).toHaveLength(1);
    const types = fake.received.map((m) => m.type);
    expect(types[0]).toBe("init");
    expect(types.at(-1)).toBe("finalize");
    // 7 frames at batchSize 3 → 3 frame batches.
    expect(types.filter((t) => t === "frames")).toHaveLength(3);
    expect(progress.length).toBeGreaterThan(0);
    expect(fake.terminated).toBe(true); // cleaned up
  });

  it("enriches totals-less worker progress with an estimated totalFrames", async () => {
    const fake = makeFakeWorker(happyBehavior);
    const service = createWorkerAnalysisService({
      makeWorker: () => fake.worker,
      // 1 s at 30 fps → estimated 30 total frames.
      makeFrameProvider: async () => makeFakeProvider(7, 1000),
      batchSize: 3,
    });

    const progress: AnalysisProgress[] = [];
    await service.analyzeVideoFile(new Blob(["v"]), opts, (p) =>
      progress.push(p),
    );

    expect(progress.length).toBeGreaterThan(0);
    for (const p of progress) {
      expect(p.totalFrames).toBe(30);
      expect(p.framesProcessed).toBeLessThanOrEqual(30);
    }
  });

  it("passes progress through untouched when duration is unknown", async () => {
    const fake = makeFakeWorker(happyBehavior);
    const service = createWorkerAnalysisService({
      makeWorker: () => fake.worker,
      makeFrameProvider: async () => makeFakeProvider(3),
      batchSize: 3,
    });
    const progress: AnalysisProgress[] = [];
    await service.analyzeVideoFile(new Blob(["v"]), opts, (p) =>
      progress.push(p),
    );
    expect(progress.length).toBeGreaterThan(0);
    for (const p of progress) expect(p.totalFrames).toBeUndefined();
  });

  it("sends the shooting options and local asset paths in init", async () => {
    const fake = makeFakeWorker(happyBehavior);
    const service = createWorkerAnalysisService({
      makeWorker: () => fake.worker,
      makeFrameProvider: async () => makeFakeProvider(1),
    });
    await service.analyzeVideoFile(new Blob(["v"]), {
      shootingHand: "left",
      profile: "youth-fundamentals",
    });
    const init = fake.received[0];
    expect(init).toMatchObject({
      type: "init",
      mode: "video",
      fps: 30,
      opts: { shootingHand: "left", profile: "youth-fundamentals" },
      assets: {
        wasmBasePath: "/mediapipe/wasm",
        modelPath: "/mediapipe/pose_landmarker_full.task",
      },
    });
  });

  it("propagates worker errors as AnalysisWorkerError", async () => {
    const fake = makeFakeWorker((message, reply) => {
      if (message.type === "init") reply({ type: "ready" });
      if (message.type === "finalize")
        reply({ type: "error", message: "model exploded" });
    });
    const service = createWorkerAnalysisService({
      makeWorker: () => fake.worker,
      makeFrameProvider: async () => makeFakeProvider(1),
    });
    await expect(
      service.analyzeVideoFile(new Blob(["v"]), opts),
    ).rejects.toThrow(AnalysisWorkerError);
    expect(fake.terminated).toBe(true);
  });

  it("cancels mid-analysis via AbortSignal", async () => {
    const controller = new AbortController();
    const fake = makeFakeWorker((message, reply) => {
      if (message.type === "init") reply({ type: "ready" });
      // Abort as soon as the first frames arrive; never send a result.
      if (message.type === "frames") controller.abort();
    });
    const service = createWorkerAnalysisService({
      makeWorker: () => fake.worker,
      makeFrameProvider: async () => makeFakeProvider(50),
      batchSize: 1,
    });
    await expect(
      service.analyzeVideoFile(new Blob(["v"]), {
        ...opts,
        signal: controller.signal,
      }),
    ).rejects.toThrow(AnalysisCancelledError);
    expect(fake.terminated).toBe(true);
  });

  it("rejects fixture refs (replay backend territory)", async () => {
    const service = createWorkerAnalysisService({
      makeWorker: () => makeFakeWorker(happyBehavior).worker,
      makeFrameProvider: async () => makeFakeProvider(1),
    });
    await expect(
      service.analyzeVideoFile({ kind: "fixture", fixtureId: "x" }, opts),
    ).rejects.toThrow(/fixture/i);
  });
});

describe("WorkerAnalysisService.createLiveSession (mocked worker)", () => {
  it("streams pushed frames through the worker and emits landmarks", async () => {
    const fake = makeFakeWorker((message, reply) => {
      if (message.type === "init") reply({ type: "ready" });
      if (message.type === "frames") {
        reply({
          type: "landmarks",
          frame: {
            frameIndex: message.frames[0]!.frameIndex,
            timestamp: message.frames[0]!.timestamp,
            poseConfidence: 0.9,
            landmarks: null,
          },
        });
      }
    });
    const service = createWorkerAnalysisService({
      makeWorker: () => fake.worker,
    });
    const session = service.createLiveSession(opts);
    const frames: number[] = [];
    session.onFrame((f) => frames.push(f.frameIndex));

    await session.start();
    session.pushFrame!({
      data: new Uint8ClampedArray([0, 0, 0, 255]),
      width: 1,
      height: 1,
      frameIndex: 42,
      timestamp: 1400,
    });
    await vi.waitFor(() => expect(frames).toEqual([42]));

    await session.stop();
    expect(fake.terminated).toBe(true);
  });
});

describe("WorkerAnalysisService live backpressure + latency fallback", () => {
  /**
   * A worker that holds landmark replies until the test releases them, so
   * "detection still running" can be simulated precisely.
   */
  function makeHeldWorker() {
    const pending: (() => void)[] = [];
    const fake = makeFakeWorker((message, reply) => {
      if (message.type === "init" || message.type === "setModel") {
        reply({ type: "ready" });
      }
      if (message.type === "frames") {
        const f = message.frames[0]!;
        pending.push(() =>
          reply({
            type: "landmarks",
            frame: {
              frameIndex: f.frameIndex,
              timestamp: f.timestamp,
              poseConfidence: 0.9,
              ...(f.captureTs !== undefined ? { captureTs: f.captureTs } : {}),
              landmarks: null,
            },
          }),
        );
      }
    });
    const releaseAll = () => {
      while (pending.length) pending.shift()!();
    };
    return { fake, pending, releaseAll };
  }

  const frame = (i: number, captureTs?: number) => ({
    data: new Uint8ClampedArray([0, 0, 0, 255]),
    width: 1,
    height: 1,
    frameIndex: i,
    timestamp: i * 66,
    ...(captureTs !== undefined ? { captureTs } : {}),
  });

  it("keeps at most one frame in flight and skips while busy", async () => {
    const { fake, pending, releaseAll } = makeHeldWorker();
    const session = createWorkerAnalysisService({
      makeWorker: () => fake.worker,
    }).createLiveSession(opts);
    const got: number[] = [];
    session.onFrame((f) => got.push(f.frameIndex));
    await session.start();

    session.pushFrame!(frame(1));
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    expect(session.isBusy!()).toBe(true);
    // Capture keeps ticking while detection is slow: these must NOT queue.
    session.pushFrame!(frame(2));
    session.pushFrame!(frame(3));
    expect(fake.received.filter((m) => m.type === "frames")).toHaveLength(1);

    releaseAll();
    await vi.waitFor(() => expect(got).toEqual([1]));
    expect(session.isBusy!()).toBe(false);
    session.pushFrame!(frame(4));
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    releaseAll();
    await vi.waitFor(() => expect(got).toEqual([1, 4]));

    const stats = session.stats!();
    expect(stats.maxInFlight).toBe(1);
    expect(stats.framesSkipped).toBeGreaterThanOrEqual(2);
    expect(stats.framesDelivered).toBe(2);
    await session.stop();
  });

  it("stamps captureTs and measures capture→landmarks latency", async () => {
    const { fake, pending, releaseAll } = makeHeldWorker();
    const session = createWorkerAnalysisService({
      makeWorker: () => fake.worker,
    }).createLiveSession(opts);
    await session.start();
    session.pushFrame!(frame(1, performance.now() - 120));
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    const sent = fake.received.find((m) => m.type === "frames");
    expect(
      sent && sent.type === "frames" && sent.frames[0]!.captureTs,
    ).toBeTypeOf("number");
    releaseAll();
    await vi.waitFor(() =>
      expect(session.stats!().p50LatencyMs).toBeGreaterThanOrEqual(120),
    );
    await session.stop();
  });

  async function driveSlow(
    session: ReturnType<
      ReturnType<typeof createWorkerAnalysisService>["createLiveSession"]
    >,
    held: ReturnType<typeof makeHeldWorker>,
    n: number,
    latencyMs: number,
  ) {
    for (let i = 0; i < n; i++) {
      await vi.waitFor(() => expect(session.isBusy!()).toBe(false));
      session.pushFrame!(frame(i, performance.now() - latencyMs));
      await vi.waitFor(() => expect(held.pending.length).toBe(1));
      held.releaseAll();
    }
    await vi.waitFor(() => expect(session.isBusy!()).toBe(false));
  }

  it("falls back to the lite model once when latency stays high (auto)", async () => {
    const held = makeHeldWorker();
    const session = createWorkerAnalysisService({
      makeWorker: () => held.fake.worker,
    }).createLiveSession(opts, {
      model: "auto",
      liteFallbackP50Ms: 150,
      windowFrames: 4,
      warmupFrames: 2,
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await session.start();
    expect(session.stats!().model).toBe("full");

    await driveSlow(session, held, 6, 400);
    const swaps = held.fake.received.filter((m) => m.type === "setModel");
    expect(swaps).toHaveLength(1);
    expect(swaps[0]).toMatchObject({
      modelPath: "/mediapipe/pose_landmarker_lite.task",
    });
    expect(session.stats!()).toMatchObject({ model: "lite", fallbacks: 1 });

    // Still slow on lite: no further swaps.
    await driveSlow(session, held, 8, 400);
    expect(
      held.fake.received.filter((m) => m.type === "setModel"),
    ).toHaveLength(1);
    info.mockRestore();
    await session.stop();
  });

  it("stays on full when fast, and honors a pinned model", async () => {
    const fast = makeHeldWorker();
    const s1 = createWorkerAnalysisService({
      makeWorker: () => fast.fake.worker,
    }).createLiveSession(opts, { windowFrames: 4, warmupFrames: 2 });
    await s1.start();
    await driveSlow(s1, fast, 8, 40);
    expect(s1.stats!().model).toBe("full");
    await s1.stop();

    const pinned = makeHeldWorker();
    const s2 = createWorkerAnalysisService({
      makeWorker: () => pinned.fake.worker,
    }).createLiveSession(opts, { model: "lite" });
    await s2.start();
    const init = pinned.fake.received.find((m) => m.type === "init");
    expect(init && init.type === "init" && init.assets.modelPath).toBe(
      "/mediapipe/pose_landmarker_lite.task",
    );
    await s2.stop();
  });

  it("does not wedge if a frame never comes back", async () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    try {
      const held = makeHeldWorker();
      const session = createWorkerAnalysisService({
        makeWorker: () => held.fake.worker,
      }).createLiveSession(opts);
      await session.start();
      session.pushFrame!(frame(1));
      expect(session.isBusy!()).toBe(true);
      vi.advanceTimersByTime(2500);
      expect(session.isBusy!()).toBe(false);
      await session.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
