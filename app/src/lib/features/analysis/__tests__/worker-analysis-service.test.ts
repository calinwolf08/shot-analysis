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
