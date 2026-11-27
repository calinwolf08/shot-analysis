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
  LiveSessionOptions,
  LiveSessionStats,
  OfflinePoseDetector,
  CachedFrame,
  ProgressCallback,
} from "../types";
import {
  createLatencyTracker,
  shouldFallBackToLite,
  type PoseModel,
} from "./latency";
import { isFixtureRef } from "../types";
import { runReplayAnalysis } from "../replay/replay-pipeline";
import {
  asAnalysisResult,
  parseFromWorker,
  type FramePayload,
  type ToWorkerMessage,
} from "./../worker/worker-protocol";

/** Live camera capture rate (frames offered to pose detection per second). */
export const LIVE_CAPTURE_FPS = 30;

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
  /** Full pose model (default for video analysis and live). */
  modelPath: string;
  /** Lite pose model (live fallback when the full model is too slow). */
  liteModelPath?: string;
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
  liteModelPath: "/mediapipe/pose_landmarker_lite.task",
};

/** How much captured video the frame cache keeps (ms). */
export const FRAME_CACHE_MS = 4000;

/** Live latency defaults (overridable from the tuning file). */
export const DEFAULT_LIVE_SESSION_OPTIONS: Required<LiveSessionOptions> = {
  model: "auto",
  liteFallbackP50Ms: 150,
  windowFrames: 30,
  warmupFrames: 15,
  debugDetectDelayMs: 0,
  delegate: "GPU",
  offlineModel: "full",
  frameCache: false,
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
  /** Where the worker's detector runs (from its last "ready"; null = unknown). */
  readonly delegate: "GPU" | "CPU" | null;
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
  let delegate: "GPU" | "CPU" | null = null;

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
        delegate = message.delegate ?? null;
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
    get delegate() {
      return delegate;
    },
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
              framesProcessed: Math.min(
                p.framesProcessed,
                estimatedTotalFrames,
              ),
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

    createLiveSession(
      opts: AnalyzeOptions,
      liveOpts: LiveSessionOptions = {},
    ): LiveAnalysisSession {
      const live = { ...DEFAULT_LIVE_SESSION_OPTIONS, ...liveOpts };
      const subscribers = new Set<(frame: LandmarkFrame) => void>();
      let handle: WorkerHandle | null = null;
      // 30 fps: v3 timing metrics need it (a reference rise lasts ~4 frames
      // at 30 fps). Backpressure below skips ticks on phones that can't keep
      // up, and every frame keeps its real capture time, so timing stays
      // correct at whatever rate is actually achieved.
      const fps = LIVE_CAPTURE_FPS;
      const liteModelPath =
        assets.liteModelPath ?? DEFAULT_ASSETS.liteModelPath!;

      // Backpressure: at most ONE frame in the worker at a time. Without it,
      // capture kept posting frames while a slow phone needed >66 ms per
      // frame, the worker queue grew without bound, and the skeleton (and the
      // positioning cues) lagged further and further behind the player.
      let inFlight = 0;
      let sentAt = 0;
      let maxInFlight = 0;
      /** A frame that never comes back (worker error) must not wedge capture. */
      const STALL_MS = 2000;
      const busy = (): boolean => {
        if (swapping || offlineBusy) return true;
        if (inFlight > 0 && performance.now() - sentAt > STALL_MS) {
          inFlight = 0;
        }
        return inFlight > 0;
      };
      let swapping = false;

      // Offline (full-rate) detector: its own worker + MediaPipe instance, so
      // the live detector's VIDEO-mode tracking and timestamps are untouched.
      // Created on first use and kept for the session.
      let offline: WorkerHandle | null = null;
      /** Recent captured frames (see cacheFrame). */
      const frameCache: CachedFrame[] = [];
      const cacheSubscribers = new Set<(f: CachedFrame) => void>();
      /** Adds a captured frame to the cache (see LiveAnalysisSession). */
      function cacheFrame(frame: CachedFrame): void {
        const last = frameCache.at(-1);
        if (last && frame.timestamp <= last.timestamp) return;
        frameCache.push(frame);
        const cutoff = frame.timestamp - FRAME_CACHE_MS;
        while (frameCache.length > 0 && frameCache[0]!.timestamp < cutoff)
          frameCache.shift();
        for (const cb of cacheSubscribers) cb(frame);
      }

      let offlineReady: Promise<void> | null = null;
      let offlineBusy = false;
      let offlineCb: ((f: LandmarkFrame) => void) | null = null;
      /** Last timestamp given to the offline detector (must increase). */
      let offlineLastTs = -Infinity;
      function ensureOffline(): Promise<void> {
        if (offlineReady) return offlineReady;
        const h = wrapWorker(makeWorker());
        offline = h;
        h.onLandmarks((f) => offlineCb?.(f));
        const ready = h.waitReady();
        h.send({
          type: "init",
          opts: { shootingHand: opts.shootingHand, profile: opts.profile },
          mode: "live",
          fps,
          // The accurate pass: the full model unless told otherwise.
          assets: {
            wasmBasePath: assets.wasmBasePath,
            modelPath:
              live.offlineModel === "lite" ? liteModelPath : assets.modelPath,
          },
          delegate: live.delegate,
          ...(live.debugDetectDelayMs > 0
            ? { debugDetectDelayMs: live.debugDetectDelayMs }
            : {}),
        });
        offlineReady = ready.catch((err) => {
          offlineReady = null;
          offline?.terminate();
          offline = null;
          throw err;
        });
        return offlineReady;
      }
      let model: PoseModel = live.model === "lite" ? "lite" : "full";
      const latency = createLatencyTracker(live.windowFrames);
      let delivered = 0;
      let skipped = 0;
      let lastSize: { width: number; height: number } | null = null;
      let fallbacks = 0;

      async function fallBackToLite(): Promise<void> {
        if (!handle) return;
        swapping = true;
        model = "lite";
        fallbacks += 1;
        console.info(
          `[live] pose latency p50 ${Math.round(latency.p50() ?? 0)} ms > ${live.liteFallbackP50Ms} ms — switching to the lite model`,
        );
        const ready = handle.waitReady();
        handle.send({ type: "setModel", modelPath: liteModelPath });
        try {
          await ready;
        } finally {
          latency.reset();
          swapping = false;
        }
      }

      return {
        fps,
        onFrame(cb) {
          subscribers.add(cb);
          return () => subscribers.delete(cb);
        },

        async start() {
          handle = wrapWorker(makeWorker());
          handle.onLandmarks((frame) => {
            inFlight = Math.max(0, inFlight - 1);
            delivered += 1;
            if (frame.captureTs !== undefined) {
              latency.add(performance.now() - frame.captureTs);
            }
            for (const cb of subscribers) cb(frame);
            if (
              !swapping &&
              shouldFallBackToLite(model, latency, {
                policy: live.model,
                liteFallbackP50Ms: live.liteFallbackP50Ms,
                warmupFrames: live.warmupFrames,
                windowFrames: live.windowFrames,
              })
            ) {
              void fallBackToLite();
            }
          });
          const ready = handle.waitReady();
          handle.send({
            type: "init",
            opts: { shootingHand: opts.shootingHand, profile: opts.profile },
            mode: "live",
            fps,
            assets: {
              wasmBasePath: assets.wasmBasePath,
              modelPath: model === "lite" ? liteModelPath : assets.modelPath,
            },
            delegate: live.delegate,
            ...(live.debugDetectDelayMs > 0
              ? { debugDetectDelayMs: live.debugDetectDelayMs }
              : {}),
          });
          await ready;
          // Load the offline (full-rate) detector in the background once the
          // live one is running, so the first shot doesn't wait for it.
          setTimeout(() => {
            if (handle) void ensureOffline().catch(() => undefined);
          }, 3000);
        },

        // Called once per capture tick; a busy answer is a skipped tick.
        isBusy() {
          const b = busy();
          if (b) skipped += 1;
          return b;
        },

        pushFrame(frame: FramePayload) {
          if (!handle) return;
          if (busy()) {
            skipped += 1;
            return;
          }
          inFlight += 1;
          sentAt = performance.now();
          lastSize = { width: frame.width, height: frame.height };
          maxInFlight = Math.max(maxInFlight, inFlight);
          handle.send(
            {
              type: "frames",
              frames: [
                { ...frame, captureTs: frame.captureTs ?? performance.now() },
              ],
            },
            [frame.data.buffer as ArrayBuffer],
          );
        },

        frameSize() {
          return lastSize;
        },

        ...(live.frameCache ? { cacheFrame } : {}),

        cachedFrames(fromTs: number, toTs: number): CachedFrame[] {
          return frameCache
            .filter((f) => f.timestamp >= fromTs && f.timestamp <= toTs)
            .map((f) => ({ ...f, data: f.data.slice() }));
        },

        onCachedFrame(cb: (frame: CachedFrame) => void) {
          cacheSubscribers.add(cb);
          return () => cacheSubscribers.delete(cb);
        },

        detectOffline(o: { pauseLive?: boolean } = {}): OfflinePoseDetector {
          let pausing = o.pauseLive ?? true;
          if (pausing) offlineBusy = true;
          const out: LandmarkFrame[] = [];
          const queued: {
            data: Uint8ClampedArray;
            width: number;
            height: number;
            frameIndex: number;
            timestamp: number;
          }[] = [];
          let pushed = 0;
          let cancelled = false;
          let finishResolve: ((f: LandmarkFrame[]) => void) | null = null;
          let finishReject: ((e: Error) => void) | null = null;
          // VIDEO mode needs strictly increasing timestamps across batches:
          // shift this batch past the last one, then shift results back.
          let shift = 0;
          let shiftSet = false;
          const settle = () => {
            if (finishResolve && out.length >= pushed) {
              offlineBusy = false;
              offlineCb = null;
              finishResolve(out);
              finishResolve = null;
            }
          };
          const ready = ensureOffline();
          const send = (f: (typeof queued)[number]) => {
            if (!shiftSet) {
              shift = Math.max(0, offlineLastTs + 1 - f.timestamp);
              shiftSet = true;
            }
            const ts = f.timestamp + shift;
            offlineLastTs = Math.max(offlineLastTs, ts);
            offline!.send(
              { type: "frames", frames: [{ ...f, timestamp: ts }] },
              [f.data.buffer as ArrayBuffer],
            );
          };
          void ready.then(
            () => {
              if (cancelled) return;
              offlineCb = (f) => {
                if (cancelled) return;
                out.push({ ...f, timestamp: f.timestamp - shift });
                settle();
              };
              for (const f of queued.splice(0)) send(f);
            },
            (err: unknown) => {
              offlineBusy = false;
              finishReject?.(
                err instanceof Error ? err : new Error(String(err)),
              );
            },
          );
          return {
            push(frame) {
              if (cancelled) return;
              pushed += 1;
              if (offlineCb) send(frame);
              else queued.push(frame);
            },
            finish() {
              return new Promise<LandmarkFrame[]>((resolve, reject) => {
                finishResolve = resolve;
                finishReject = reject;
                settle();
              });
            },
            cancel() {
              cancelled = true;
              offlineBusy = false;
              offlineCb = null;
              finishResolve?.(out);
              finishResolve = null;
            },
            pauseLive(on: boolean) {
              if (cancelled) return;
              pausing = on;
              offlineBusy = on;
            },
          };
        },

        stats(): LiveSessionStats {
          return {
            model,
            p50LatencyMs: latency.p50(),
            framesDelivered: delivered,
            framesSkipped: skipped,
            maxInFlight,
            fallbacks,
            delegate: handle?.delegate ?? null,
            offlineDelegate: offline?.delegate ?? null,
            offlineModel: live.offlineModel,
          };
        },

        async analyzeWindow(frames) {
          // Pure JS over landmarks — bounded rep window, fine on-main-thread.
          return runReplayAnalysis(frames, opts, { fps });
        },

        async stop() {
          handle?.terminate();
          handle = null;
          offline?.terminate();
          offline = null;
          offlineReady = null;
          offlineBusy = false;
          inFlight = 0;
        },
      } as LiveAnalysisSession & { pushFrame(frame: FramePayload): void };
    },
  };
}
