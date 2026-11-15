/**
 * Analysis Web Worker: owns the MediaPipe pose detector. Receives RGBA
 * frames from the main thread, detects poses, and either
 * - accumulates LandmarkFrames and runs the full pipeline on finalize
 *   (video mode), or
 * - streams each LandmarkFrame straight back (live mode; the
 *   LiveRepCoordinator decides when to analyze a window on-main-thread).
 */

// MediaPipe's FilesetResolver tries importScripts() (unavailable in module
// workers), then falls back to self.import(). The WASM JS files are classic
// scripts (not ES modules) that register a factory on globalThis, so we
// load them via fetch + eval to execute in the global scope.
const workerSelf = self as unknown as Record<string, unknown>;
if (typeof workerSelf.import !== "function") {
  workerSelf.import = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const text = await res.text();
    // Indirect eval executes in global scope, matching importScripts behavior.
    (0, eval)(text);
  };
}

import { createPoseDetector } from "basketball-shot-analysis";
import type { PoseData } from "basketball-shot-analysis";
import type { AnalyzeOptions, LandmarkFrame } from "../types";
import {
  landmarkFramesToPoseData,
  runReplayAnalysis,
} from "../replay/replay-pipeline";
import {
  parseToWorker,
  type FramePayload,
  type FromWorkerMessage,
} from "./worker-protocol";

type PoseDetector = Awaited<ReturnType<typeof createPoseDetector>>;

interface WorkerState {
  detector: PoseDetector | null;
  mode: "video" | "live";
  fps: number;
  opts: AnalyzeOptions | null;
  collected: LandmarkFrame[];
  framesProcessed: number;
  cancelled: boolean;
  /** Frame dimensions, captured from the incoming RGBA frames. */
  width: number;
  height: number;
}

const state: WorkerState = {
  detector: null,
  mode: "video",
  fps: 30,
  opts: null,
  collected: [],
  framesProcessed: 0,
  cancelled: false,
  width: 0,
  height: 0,
};

/**
 * Outbound messages carry library types whose arrays are `readonly`; the
 * Zod-inferred protocol types are structurally identical but mutable.
 */
type FromWorkerPost =
  | Exclude<FromWorkerMessage, { type: "result" } | { type: "landmarks" }>
  | {
      type: "result";
      result: import("basketball-shot-analysis").AnalysisResult;
    }
  | { type: "landmarks"; frame: LandmarkFrame }
  | { type: "poses"; poseData: PoseData };

function post(message: FromWorkerPost): void {
  (self as unknown as Worker).postMessage(message);
}

async function handleFrames(frames: FramePayload[]): Promise<void> {
  if (!state.detector) throw new Error("worker not initialized");
  for (const frame of frames) {
    if (state.cancelled) return;
    if (state.width === 0) {
      state.width = frame.width;
      state.height = frame.height;
    }
    const pose = await state.detector.detect({
      data: frame.data,
      width: frame.width,
      height: frame.height,
      timestamp: frame.timestamp,
      frameIndex: frame.frameIndex,
    });
    const landmarkFrame: LandmarkFrame = {
      frameIndex: frame.frameIndex,
      timestamp: frame.timestamp,
      poseConfidence: pose?.poseConfidence ?? 0,
      landmarks: pose ? pose.landmarks : null,
    };
    state.framesProcessed += 1;

    if (state.mode === "live") {
      post({ type: "landmarks", frame: landmarkFrame });
    } else {
      state.collected.push(landmarkFrame);
      if (state.framesProcessed % 15 === 0) {
        post({
          type: "progress",
          progress: {
            framesProcessed: state.framesProcessed,
            shotsDetected: 0,
            phase: "detecting",
          },
        });
      }
    }
  }
}

function handleFinalize(): void {
  if (!state.opts) throw new Error("worker not initialized");
  const result = runReplayAnalysis(state.collected, state.opts, {
    fps: state.fps,
    onProgress: (progress) => post({ type: "progress", progress }),
  });
  post({ type: "result", result });
}

/**
 * Returns the collected poses (for server-side analysis) instead of running the
 * pipeline. Landmark visibility doubles as the persisted confidence (the
 * server's poseDataToLandmarkFrames uses visibility), and timestamps are
 * rebased to seconds from the frame index so the payload is self-describing.
 */
function handleFinalizePoses(): void {
  const poseData: PoseData = landmarkFramesToPoseData(
    state.collected,
    state.fps,
    { width: state.width, height: state.height },
  );
  post({ type: "poses", poseData });
}

self.onmessage = async (event: MessageEvent) => {
  try {
    const message = parseToWorker(event.data);
    switch (message.type) {
      case "init": {
        state.mode = message.mode;
        state.fps = message.fps;
        state.opts = message.opts;
        state.collected = [];
        state.framesProcessed = 0;
        state.cancelled = false;
        state.width = 0;
        state.height = 0;
        state.detector = await createPoseDetector({
          runtime: "browser",
          wasmBasePath: message.assets.wasmBasePath,
          modelPath: message.assets.modelPath,
          runningMode: "VIDEO",
        });
        post({ type: "ready" });
        break;
      }
      case "frames":
        await handleFrames(message.frames);
        break;
      case "finalize":
        handleFinalize();
        break;
      case "finalizePoses":
        handleFinalizePoses();
        break;
      case "cancel":
        state.cancelled = true;
        state.collected = [];
        break;
    }
  } catch (err) {
    post({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
