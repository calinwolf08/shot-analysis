/**
 * Full-frame-rate re-detection of a rep from its recorded clip.
 *
 * Live pose tracking runs at whatever rate the phone manages (~10 fps on a
 * slow one). Shot detection and the timing / release metrics degrade badly at
 * that rate (see debug/__tests__/fps-compare.test.ts), so before a shot is
 * scored, the rep window is re-detected from the clip, frame by frame, on a
 * separate pose detector. The coordinator then analyzes THESE frames, and the
 * shot is scored, stored and reviewed from them.
 *
 * The clip that covers the rep is taken from the rolling recorder here (and
 * kept for the shot's review: `takeClip`), so the recorder restarts at once
 * for the next shot.
 *
 * Returns null (→ the caller falls back to the live frames) when there's no
 * recorder or clip, decoding fails, or too few frames come back with a pose.
 */
import type {
  LandmarkFrame,
  LiveAnalysisSession,
  OfflinePoseDetector,
} from "$lib/features/analysis";
import {
  decodeClipRange,
  type DecodeClipStats,
  type DecodedClipFrame,
} from "$lib/shared/media/clip-decode";
import type {
  ClipTake,
  ShotClipRecorder,
} from "$lib/shared/media/shot-clip-recorder";
import type { RepWindow } from "../coordinator/coordinator";

export interface RefineReport {
  readonly ok: boolean;
  /** Why it fell back (when !ok). */
  readonly reason?: string;
  readonly liveFrames: number;
  readonly frames: number;
  readonly posed: number;
  readonly ms: number;
  /** Frames per second of the refined window (pose clock). */
  readonly fps: number | null;
  readonly decode?: DecodeClipStats;
}

export interface FullRateRefiner {
  /** The rolling clip recorder (PracticeScreen owns it), and how to restart it. */
  setRecorder(recorder: ShotClipRecorder | null, restart?: () => void): void;
  /** Re-detect a rep window from the clip; null = use the live frames. */
  refine(window: RepWindow): Promise<LandmarkFrame[] | null>;
  /** The clip taken for the rep that started at `repStartTs` (once). */
  takeClip(repStartTs: number): ClipTake | null;
  /** Called with each refinement's outcome (diagnostics). */
  onReport(cb: (r: RefineReport) => void): () => void;
}

export interface FullRateRefinerDeps {
  session: Pick<LiveAnalysisSession, "detectOffline">;
  decode?: typeof decodeClipRange;
  /** Whole refinement budget (ms); past it the frames so far are used. */
  timeoutMs?: number;
  /** Fewer posed frames than this share of the live window's → fall back. */
  minPosedShare?: number;
  now?: () => number;
}

export function createFullRateRefiner(
  deps: FullRateRefinerDeps,
): FullRateRefiner {
  const decode = deps.decode ?? decodeClipRange;
  const timeoutMs = deps.timeoutMs ?? 30_000;
  const minPosedShare = deps.minPosedShare ?? 1;
  const now = deps.now ?? (() => performance.now());
  let recorder: ShotClipRecorder | null = null;
  let restart: (() => void) | null = null;
  let stash: { repStartTs: number; take: ClipTake } | null = null;
  const listeners = new Set<(r: RefineReport) => void>();
  const report = (r: RefineReport) => {
    for (const cb of listeners) cb(r);
  };

  return {
    setRecorder(r, re) {
      recorder = r;
      restart = re ?? null;
    },

    onReport(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    takeClip(repStartTs) {
      if (!stash || stash.repStartTs !== repStartTs) return null;
      const t = stash.take;
      stash = null;
      return t;
    },

    async refine(window) {
      const t0 = now();
      const live = window.frames;
      const base = {
        liveFrames: live.length,
        frames: 0,
        posed: 0,
        fps: null,
      };
      const fail = (reason: string, extra: Partial<RefineReport> = {}) => {
        report({ ok: false, reason, ms: now() - t0, ...base, ...extra });
        return null;
      };
      stash = null;
      if (!deps.session.detectOffline) return fail("no offline detector");
      if (!recorder?.recording) return fail("no clip recording");
      const first = live[0];
      const last = live.at(-1);
      if (!first || !last) return fail("empty window");
      // Pose clock → performance.now() (the recorder's clock).
      const frameToWall =
        last.captureTs !== undefined ? last.captureTs - last.timestamp : 0;
      const take = await recorder.takeCovering(first.timestamp + frameToWall);
      restart?.();
      if (!take) return fail("no clip");
      stash = { repStartTs: window.startedAt, take };
      const clipStartPose = take.startTs - frameToWall;
      const fromS = Math.max(0, (first.timestamp - clipStartPose) / 1000);
      const toS = (window.endedAt - clipStartPose) / 1000;

      const detector: OfflinePoseDetector = deps.session.detectOffline();
      let pushed = 0;
      let lastTs = -Infinity;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        detector.cancel();
      }, timeoutMs);
      let decodeStats: DecodeClipStats | undefined;
      let frames: LandmarkFrame[] = [];
      try {
        decodeStats = await decode(
          take.blob,
          fromS,
          toS,
          (f: DecodedClipFrame) => {
            const ts = Math.max(lastTs + 1, clipStartPose + f.mediaTime * 1000);
            lastTs = ts;
            detector.push({
              data: f.data,
              width: f.width,
              height: f.height,
              frameIndex: pushed++,
              timestamp: ts,
            });
          },
          { cancelled: () => timedOut },
        );
        frames = await detector.finish();
      } catch (err) {
        detector.cancel();
        return fail(err instanceof Error ? err.message : String(err), {
          ...(decodeStats ? { decode: decodeStats } : {}),
        });
      } finally {
        clearTimeout(timer);
      }
      const posed = frames.filter((f) => f.landmarks).length;
      const livePosed = live.filter((f) => f.landmarks).length;
      const span =
        frames.length > 1
          ? (frames.at(-1)!.timestamp - frames[0]!.timestamp) / 1000
          : 0;
      const stats = {
        frames: frames.length,
        posed,
        fps: span > 0 ? (frames.length - 1) / span : null,
        ...(decodeStats ? { decode: decodeStats } : {}),
      };
      if (posed < Math.max(5, livePosed * minPosedShare))
        return fail(timedOut ? "timed out" : "too few posed frames", stats);
      report({ ok: true, ms: now() - t0, liveFrames: live.length, ...stats });
      // Same clock mapping as the live frames (the clip is aligned by it).
      return frames.map((f) => ({
        ...f,
        captureTs: f.timestamp + frameToWall,
      }));
    },
  };
}
