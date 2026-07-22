/**
 * ReplayAnalysisService — the deterministic test backbone. Produces real
 * AnalysisResults from recorded pose-sequence fixtures (test-data poses.json
 * shape) through the library's public detection + metrics pipeline. No
 * MediaPipe, no camera, byte-stable across runs.
 */
import { poseDataSchema, type PoseData } from "basketball-shot-analysis";
import type {
  AnalysisInput,
  AnalysisService,
  AnalyzeOptions,
  LandmarkFrame,
  LiveAnalysisSession,
  ProgressCallback,
} from "../types";
import { isFixtureRef } from "../types";
import { poseDataToLandmarkFrames, runReplayAnalysis } from "./replay-pipeline";

export type FixtureLoader = (fixtureId: string) => Promise<unknown>;

export interface ReplayAnalysisServiceOptions {
  /** Loads raw fixture JSON by id (fs in Node tests, fetch in the browser). */
  loadFixture: FixtureLoader;
  /**
   * Live replay pacing: schedule `cb` after `ms`. Tests inject an immediate
   * scheduler; default is setTimeout.
   */
  schedule?: (cb: () => void, ms: number) => () => void;
  /** Which fixture createLiveSession replays (defaults to first loaded). */
  liveFixtureId?: string;
  /** Playback speed multiplier for live replay (default 1). */
  liveSpeed?: number;
  /**
   * Restart the fixture when it ends (timestamps keep advancing), so the
   * live stream behaves like a camera that never stops. Default false.
   */
  liveLoop?: boolean;
}

const defaultSchedule = (cb: () => void, ms: number): (() => void) => {
  const t = setTimeout(cb, ms);
  return () => clearTimeout(t);
};

export class FixtureNotSupportedError extends Error {
  constructor() {
    super(
      "ReplayAnalysisService only accepts fixture refs ({ kind: 'fixture', fixtureId }) — real video Blobs need the worker analysis service",
    );
    this.name = "FixtureNotSupportedError";
  }
}

export function createReplayAnalysisService(
  options: ReplayAnalysisServiceOptions,
): AnalysisService {
  const schedule = options.schedule ?? defaultSchedule;

  async function loadPoseData(fixtureId: string): Promise<PoseData> {
    const raw = await options.loadFixture(fixtureId);
    return poseDataSchema.parse(raw);
  }

  return {
    async analyzeVideoFile(
      input: AnalysisInput,
      opts: AnalyzeOptions,
      onProgress?: ProgressCallback,
    ) {
      if (!isFixtureRef(input)) throw new FixtureNotSupportedError();
      const pose = await loadPoseData(input.fixtureId);
      const frames = poseDataToLandmarkFrames(pose);
      return runReplayAnalysis(frames, opts, {
        fps: pose.fps,
        width: pose.width,
        height: pose.height,
        ...(onProgress ? { onProgress } : {}),
      });
    },

    async extractPoses(input: AnalysisInput, _opts: AnalyzeOptions) {
      // A replay fixture already *is* recorded pose data.
      if (!isFixtureRef(input)) throw new FixtureNotSupportedError();
      return loadPoseData(input.fixtureId);
    },

    createLiveSession(opts: AnalyzeOptions): LiveAnalysisSession {
      const fixtureId = options.liveFixtureId;
      if (!fixtureId) {
        throw new Error(
          "ReplayAnalysisService.createLiveSession requires liveFixtureId",
        );
      }
      return createReplayLiveSession({
        loadPoseData: () => loadPoseData(fixtureId),
        schedule,
        speed: options.liveSpeed ?? 1,
        loop: options.liveLoop ?? false,
        opts,
      });
    },
  };
}

interface ReplayLiveSessionDeps {
  loadPoseData: () => Promise<PoseData>;
  schedule: (cb: () => void, ms: number) => () => void;
  speed: number;
  loop: boolean;
  opts: AnalyzeOptions;
}

function createReplayLiveSession(
  deps: ReplayLiveSessionDeps,
): LiveAnalysisSession {
  const subscribers = new Set<(frame: LandmarkFrame) => void>();
  let cancel: (() => void) | null = null;
  let stopped = false;
  let fps = 30;

  return {
    get fps() {
      return fps;
    },
    onFrame(cb) {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },

    async start() {
      const pose = await deps.loadPoseData();
      fps = pose.fps;
      const frames = poseDataToLandmarkFrames(pose);
      const intervalMs = 1000 / (pose.fps * deps.speed);
      const spanFrames = frames.length;
      const spanMs = spanFrames * (1000 / pose.fps);
      let i = 0;
      let lap = 0;
      const tick = () => {
        if (stopped) return;
        if (i >= frames.length) {
          if (!deps.loop) return;
          // Loop: replay from the top with monotonic indexes/timestamps.
          i = 0;
          lap += 1;
        }
        const source = frames[i];
        i += 1;
        if (source) {
          const frame =
            lap === 0
              ? source
              : {
                  ...source,
                  frameIndex: source.frameIndex + lap * spanFrames,
                  timestamp: source.timestamp + lap * spanMs,
                };
          for (const cb of subscribers) cb(frame);
        }
        cancel = deps.schedule(tick, intervalMs);
      };
      tick();
    },

    async analyzeWindow(frames) {
      return runReplayAnalysis(frames, deps.opts, { fps });
    },

    async stop() {
      stopped = true;
      cancel?.();
      cancel = null;
    },
  };
}
