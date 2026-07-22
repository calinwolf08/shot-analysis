/**
 * WorkerAnalysisService — the production analysis path. Video frames are
 * decoded on the main thread (library VideoElementProvider), transferred to
 * the analysis worker for pose detection, and the full pipeline runs in the
 * worker on finalize. Live mode streams downsampled frames and returns
 * LandmarkFrames; window analysis runs on the main thread (pure JS over
 * landmarks, bounded cost).
 */
import type {
  AnalysisResult,
  FrameProvider,
  PoseData,
} from "basketball-shot-analysis";
import type {
  AnalysisInput,
  AnalysisService,
  AnalyzeOptions,
  LandmarkFrame,
  LiveAnalysisSession,
  ProgressCallback,
} from "../types";
import { isFixtureRef } from "../types";
import { runReplayAnalysis } from "../replay/replay-pipeline";
import {
  asAnalysisResult,
  parseFromWorker,
  type FramePayload,
  type ToWorkerMessage,
} from "./../worker/worker-protocol";

/** The slice of Worker the service needs (mockable in tests). */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(
    type: "message" | "error",
    listener: (event: MessageEvent & ErrorEvent) => void,
  ): void;
  terminate(): void;
}

export interface WorkerAssets {
  wasmBasePath: string;
  modelPath: string;
}

export interface WorkerAnalysisServiceDeps {
  makeWorker?: () => WorkerLike;
  makeFrameProvider?: (file: Blob) => Promise<FrameProvider>;
  assets?: WorkerAssets;
  /** Frames per postMessage batch (default 5). */
  batchSize?: number;
}

const DEFAULT_ASSETS: WorkerAssets = {
  wasmBasePath: "/mediapipe/wasm",
  modelPath: "/mediapipe/pose_landmarker_full.task",
};

function defaultMakeWorker(): WorkerLike {
  // Must stay a MODULE worker: Vite dev serves worker sources as ESM, so a
  // classic-typed worker crashes at runtime in `npm run dev` ("Worker
  // crashed"). MediaPipe's WASM loader can't use importScripts() in a module
  // worker and falls back to `self.import` — which analysis.worker.ts shims
  // (fetch + global eval) so the runtime loads in both dev and prod.
  return new Worker(new URL("../worker/analysis.worker.ts", import.meta.url), {
    type: "module",
  }) as unknown as WorkerLike;
}

async function defaultMakeFrameProvider(file: Blob): Promise<FrameProvider> {
  const { createVideoElementProvider } =
    await import("basketball-shot-analysis");
  return createVideoElementProvider(file);
}

export class AnalysisCancelledError extends Error {
  constructor() {
    super("Analysis cancelled");
    this.name = "AnalysisCancelledError";
  }
}

export class AnalysisWorkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisWorkerError";
  }
}

interface WorkerHandle {
  worker: WorkerLike;
  send(message: ToWorkerMessage, transfer?: Transferable[]): void;
  waitReady(): Promise<void>;
  waitResult(): Promise<AnalysisResult>;
  waitPoses(): Promise<PoseData>;
  onProgress(cb: ProgressCallback): void;
  onLandmarks(cb: (frame: LandmarkFrame) => void): void;
  terminate(): void;
}

function wrapWorker(worker: WorkerLike): WorkerHandle {
  let readyResolve: (() => void) | null = null;
  let readyReject: ((err: Error) => void) | null = null;
  let resultResolve: ((r: AnalysisResult) => void) | null = null;
  let resultReject: ((err: Error) => void) | null = null;
  let posesResolve: ((p: PoseData) => void) | null = null;
  let posesReject: ((err: Error) => void) | null = null;
  let progressCb: ProgressCallback | null = null;
  let landmarksCb: ((frame: LandmarkFrame) => void) | null = null;

  const fail = (err: Error) => {
    readyReject?.(err);
    resultReject?.(err);
    posesReject?.(err);
    readyReject = readyResolve = null;
    resultReject = resultResolve = null;
    posesReject = posesResolve = null;
  };

  worker.addEventListener("message", (event) => {
    let message;
    try {
      message = parseFromWorker((event as MessageEvent).data);
    } catch (err) {
      fail(new AnalysisWorkerError(`Bad worker message: ${String(err)}`));
      return;
    }
    switch (message.type) {
      case "ready":
        readyResolve?.();
        readyResolve = readyReject = null;
        break;
      case "progress":
        progressCb?.(message.progress);
        break;
      case "landmarks":
        landmarksCb?.(message.frame);
        break;
      case "result":
        resultResolve?.(asAnalysisResult(message.result));
        resultResolve = resultReject = null;
        break;
      case "poses":
        posesResolve?.(message.poseData as unknown as PoseData);
        posesResolve = posesReject = null;
        break;
      case "error":
        fail(new AnalysisWorkerError(message.message));
        break;
    }
  });
  worker.addEventListener("error", (event) => {
    fail(
      new AnalysisWorkerError(
        (event as ErrorEvent).message ?? "Worker crashed",
      ),
    );
  });

  return {
    worker,
    send: (message, transfer) => worker.postMessage(message, transfer),
    waitReady: () =>
      new Promise<void>((resolve, reject) => {
        readyResolve = resolve;
        readyReject = reject;
      }),
    waitResult: () =>
      new Promise<AnalysisResult>((resolve, reject) => {
        resultResolve = resolve;
        resultReject = reject;
      }),
    waitPoses: () =>
      new Promise<PoseData>((resolve, reject) => {
        posesResolve = resolve;
        posesReject = reject;
      }),
    onProgress: (cb) => {
      progressCb = cb;
    },
    onLandmarks: (cb) => {
      landmarksCb = cb;
    },
    terminate: () => worker.terminate(),
  };
}

export function createWorkerAnalysisService(
  deps: WorkerAnalysisServiceDeps = {},
): AnalysisService {
  const makeWorker = deps.makeWorker ?? defaultMakeWorker;
  const makeFrameProvider = deps.makeFrameProvider ?? defaultMakeFrameProvider;
  const assets = deps.assets ?? DEFAULT_ASSETS;
  const batchSize = deps.batchSize ?? 5;

  /**
   * Detects poses over every video frame, then finalizes. `finalize` chooses
   * whether the worker runs the full pipeline (`"finalize"` → AnalysisResult)
   * or just returns the collected poses (`"finalizePoses"` → PoseData);
   * `wait` picks the matching completion promise. Shared by analyzeVideoFile
   * (client-only path) and extractPoses (server-analysis path).
   */
  async function detectAndFinalize<T>(
    input: AnalysisInput,
    opts: AnalyzeOptions,
    finalize: "finalize" | "finalizePoses",
    wait: (h: WorkerHandle) => Promise<T>,
    onProgress?: ProgressCallback,
  ): Promise<T> {
    if (isFixtureRef(input)) {
      throw new Error(
        "WorkerAnalysisService analyzes real video files; fixture refs need the replay backend",
      );
    }
    const provider = await makeFrameProvider(input);
    const handle = wrapWorker(makeWorker());
    const abort = () => {
      handle.send({ type: "cancel" });
      handle.terminate();
    };
    if (opts.signal?.aborted) {
      handle.terminate();
      throw new AnalysisCancelledError();
    }
    opts.signal?.addEventListener("abort", abort, { once: true });

    // The worker only sees frames in batches and can't know the video
    // length, so its progress events lack totalFrames — without this the
    // UI's progress bar never advances. Estimate the total here from the
    // provider's metadata and enrich each event (a worker-supplied total,
    // if one ever appears, wins).
    const durationMs = provider.getMetadata().duration;
    const estimatedTotalFrames =
      durationMs !== undefined && durationMs > 0
        ? Math.max(1, Math.round((durationMs / 1000) * provider.getFps()))
        : undefined;

    try {
      if (onProgress) {
        handle.onProgress((p) => {
          if (p.totalFrames === undefined && estimatedTotalFrames) {
            onProgress({
              ...p,
              framesProcessed: Math.min(p.framesProcessed, estimatedTotalFrames),
              totalFrames: estimatedTotalFrames,
            });
          } else {
            onProgress(p);
          }
        });
      }
      const ready = handle.waitReady();
      handle.send({
        type: "init",
        opts: { shootingHand: opts.shootingHand, profile: opts.profile },
        mode: "video",
        fps: provider.getFps(),
        assets,
      });
      await ready;

      let batch: FramePayload[] = [];
      const flush = () => {
        if (batch.length === 0) return;
        handle.send(
          { type: "frames", frames: batch },
          batch.map((f) => f.data.buffer as ArrayBuffer),
        );
        batch = [];
      };

      let frame = await provider.getNextFrame();
      while (frame !== null) {
        if (opts.signal?.aborted) throw new AnalysisCancelledError();
        batch.push({
          data: frame.data,
          width: frame.width,
          height: frame.height,
          frameIndex: frame.frameIndex,
          timestamp: frame.timestamp,
        });
        if (batch.length >= batchSize) flush();
        frame = await provider.getNextFrame();
      }
      flush();

      const done = wait(handle);
      handle.send({ type: finalize });
      return await done;
    } catch (err) {
      if (opts.signal?.aborted) throw new AnalysisCancelledError();
      throw err;
    } finally {
      opts.signal?.removeEventListener("abort", abort);
      handle.terminate();
    }
  }

  return {
    analyzeVideoFile: (input, opts, onProgress) =>
      detectAndFinalize(
        input,
        opts,
        "finalize",
        (h) => h.waitResult(),
        onProgress,
      ),

    extractPoses: (input, opts, onProgress) =>
      detectAndFinalize(
        input,
        opts,
        "finalizePoses",
        (h) => h.waitPoses(),
        onProgress,
      ),

    createLiveSession(opts: AnalyzeOptions): LiveAnalysisSession {
      const subscribers = new Set<(frame: LandmarkFrame) => void>();
      let handle: WorkerHandle | null = null;
      const fps = 15;

      return {
        onFrame(cb) {
          subscribers.add(cb);
          return () => subscribers.delete(cb);
        },

        async start() {
          handle = wrapWorker(makeWorker());
          handle.onLandmarks((frame) => {
            for (const cb of subscribers) cb(frame);
          });
          const ready = handle.waitReady();
          handle.send({
            type: "init",
            opts: { shootingHand: opts.shootingHand, profile: opts.profile },
            mode: "live",
            fps,
            assets,
          });
          await ready;
        },

        pushFrame(frame: FramePayload) {
          handle?.send({ type: "frames", frames: [frame] }, [
            frame.data.buffer as ArrayBuffer,
          ]);
        },

        async analyzeWindow(frames) {
          // Pure JS over landmarks — bounded rep window, fine on-main-thread.
          return runReplayAnalysis(frames, opts, { fps });
        },

        async stop() {
          handle?.terminate();
          handle = null;
        },
      } as LiveAnalysisSession & { pushFrame(frame: FramePayload): void };
    },
  };
}
