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
 * Only the part of the rep that is scored is re-detected: the keyframes are
 * guessed from the live frames (`span`), and the clip is decoded and
 * re-detected from Setup − SPAN_MARGIN_MS to Release + SPAN_MARGIN_MS. Those
 * frames replace the live ones in that span; the live frames around it stay,
 * so shot detection and the keyframe search keep their context. If a keyframe
 * found on the merged frames lands near an edge of the re-detected span (the
 * live guess was off), that side is extended once. Without a guess, the whole
 * rep window is re-detected.
 *
 * Returns null (→ the caller falls back to the live frames) when there's no
 * recorder or clip, decoding fails, or too few frames come back with a pose.
 */
import { computeShotKeyframes } from "basketball-shot-analysis";
import type {
  CachedFrame,
  LandmarkFrame,
  LiveAnalysisSession,
  OfflinePoseDetector,
} from "$lib/features/analysis";
import {
  decodeClipRange,
  type DecodeClipOptions,
  type DecodeClipStats,
  type DecodedClipFrame,
} from "$lib/shared/media/clip-decode";
import type {
  ClipTake,
  ShotClipRecorder,
} from "$lib/shared/media/shot-clip-recorder";
import type { RepWindow } from "../coordinator/coordinator";

/** Re-detected span: this much before Setup and after Release (ms). */
export const SPAN_MARGIN_MS = 200;
/**
 * The span also reaches this far before Load (ms). Setup marks the slow start
 * of the dip, which sparse live frames can place up to ~0.9 s late; Load (the
 * ball turning up) they find reliably. 1.5 s keeps every recorded shot's
 * Setup inside the re-detected span (see __tests__/span-compare.test.ts).
 */
export const SETUP_LOOKBACK_MS = 1500;
/** A keyframe (Setup / Release) this close to the span's edge (ms) extends that side. */
export const SPAN_EDGE_MS = 100;
/** How far an edge is extended (ms). */
export const SPAN_EXTEND_MS = 300;
/**
 * A guessed span shorter than this inside the window (ms) is a bad live
 * guess (a real one is at least SETUP_LOOKBACK_MS long): the whole window is
 * re-detected instead.
 */
export const MIN_SPAN_MS = 1000;

/** Where the scored keyframes are (pose clock, ms); null = no guess. */
export type KeyframeSpan = (
  frames: readonly LandmarkFrame[],
) => { readonly fromTs: number; readonly toTs: number } | null;

interface LiveKeyframeOpts {
  shootingHand: "left" | "right";
  /** Frame width ÷ height (null = not known yet → no guess). */
  aspect: () => number | null;
}

/** Setup / Load / Release on the pose clock, from (live) frames. */
function keyframeTimes(
  frames: readonly LandmarkFrame[],
  opts: LiveKeyframeOpts,
): {
  setup: number | null;
  load: number | null;
  release: number | null;
} | null {
  const aspect = opts.aspect();
  const posed = frames.filter((f) => f.landmarks && f.landmarks.length > 0);
  if (!aspect || posed.length < 8) return null;
  const kf = computeShotKeyframes(
    posed.map((f, i) => ({
      frameIndex: i,
      timestamp: f.timestamp,
      landmarks: f.landmarks,
    })),
    { aspect, shootingHand: opts.shootingHand },
  );
  // Fractional frame index → pose-clock time.
  const at = (x: number | null) => {
    if (x === null) return null;
    const i = Math.max(0, Math.min(posed.length - 1, Math.floor(x)));
    const j = Math.min(posed.length - 1, i + 1);
    return (
      posed[i]!.timestamp +
      (x - i) * (posed[j]!.timestamp - posed[i]!.timestamp)
    );
  };
  return {
    setup: at(kf.keyframes.setup),
    load: at(kf.keyframes.load),
    release: at(kf.keyframes.release),
  };
}

/**
 * The keyframe span guess the practice loop uses: the keyframe checks'
 * detection run on the (live) frames; Setup → Release on the pose clock.
 */
export function keyframeSpan(opts: LiveKeyframeOpts): KeyframeSpan {
  return (frames) => {
    const k = keyframeTimes(frames, opts);
    if (!k) return null;
    const setup = k.setup ?? k.load;
    const r = k.release;
    if (setup === null || r === null || !(r > setup)) return null;
    const from =
      k.load !== null ? Math.min(setup, k.load - SETUP_LOOKBACK_MS) : setup;
    return { fromTs: from, toTs: r };
  };
}

/**
 * The shot's release (pose clock) in the live frames so far, for ending a
 * rep at the release (LiveRepCoordinatorDeps.releaseAt): the same keyframe
 * detection the scoring uses, so the two can't disagree about the moment.
 */
export function keyframeRelease(
  opts: LiveKeyframeOpts,
): (frames: readonly LandmarkFrame[]) => number | null {
  return (frames) => keyframeTimes(frames, opts)?.release ?? null;
}

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
  /** Re-detected span (ms) vs the whole rep window (ms). */
  readonly spanMs?: number;
  readonly windowMs?: number;
  /** The span was extended after the first pass. */
  readonly extended?: boolean;
  /** Where the frames came from: the frame cache, or the recorded clip. */
  readonly source?: "cache" | "video";
  /** Frames already being re-detected before the rep ended (early start). */
  readonly earlyFrames?: number;
  /**
   * From the rep's end until every frame had been handed to the detector
   * (ms): the cost of getting the frames — the recording's take, load,
   * seek and 1× playback, or reading the cache. Detection overlaps it.
   */
  readonly framesMs?: number;
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
  /**
   * A rep just started (trigger at `startedAt`, window from `fromTs`): start
   * re-detecting its cached frames now, while the shot is still going, and
   * keep up with new ones; `refine` finishes it. Frame-cache mode only.
   */
  begin?(startedAt: number, fromTs: number): void;
}

export interface FullRateRefinerDeps {
  session: Pick<
    LiveAnalysisSession,
    "detectOffline" | "cachedFrames" | "onCachedFrame"
  >;
  /**
   * Where the full-rate frames come from: the recorded clip (default), or
   * the session's frame cache with an early catch-up from the rep trigger
   * (falls back to the clip when the cache doesn't reach back far enough).
   * Cache mode measured ~6% slower on a 4-core desktop (live + catch-up +
   * capture compete); kept opt-in for trying on phones.
   */
  source?: "cache" | "video";
  /**
   * Cache mode only: start re-detecting at the rep trigger (begin), while
   * live detection keeps running, instead of at the rep's end. Off by
   * default: a separate experiment from the frame source.
   */
  earlyStart?: boolean;
  /** Guesses the keyframes' span from frames; omit to re-detect the whole window. */
  span?: KeyframeSpan;
  decode?: typeof decodeClipRange;
  /** Options for the decode (e.g. seek: false — fast-forward only). */
  decodeOptions?: Pick<DecodeClipOptions, "seek" | "fastForwardRate">;
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
  const session = deps.session;
  const useCache =
    deps.source === "cache" &&
    !!session.cachedFrames &&
    !!session.onCachedFrame;

  /** The early catch-up of the rep in progress (see begin). */
  let early: {
    startedAt: number;
    fromTs: number;
    detector: OfflinePoseDetector;
    pushed: number;
    lastTs: number;
    off: () => void;
    push: (f: CachedFrame) => void;
  } | null = null;
  const dropEarly = () => {
    if (!early) return;
    early.off();
    early.detector.cancel();
    early = null;
  };
  /** Cached frames [from, to] into a detector (in order, data owned). */
  const feed = (
    detector: OfflinePoseDetector,
    frames: CachedFrame[],
    start: number,
  ) => {
    let i = start;
    for (const f of frames)
      detector.push({
        data: f.data,
        width: f.width,
        height: f.height,
        frameIndex: i++,
        timestamp: f.timestamp,
      });
    return i;
  };

  /**
   * The re-check from the frame cache: no recording, no decode. With an early
   * catch-up (begin) for this rep, most frames are already done; it's pushed
   * up to the span's end and finished. "no-cache" = the cache doesn't reach
   * back to the window's start (use the clip).
   */
  async function refineFromCache(
    window: RepWindow,
    mine: typeof early,
    t0: number,
    fail: (reason: string, extra?: Partial<RefineReport>) => null,
  ): Promise<LandmarkFrame[] | null | "no-cache"> {
    const live = window.frames;
    const first = live[0]!;
    const last = live.at(-1)!;
    const frameToWall =
      last.captureTs !== undefined ? last.captureTs - last.timestamp : 0;
    const wantFrom = Math.min(first.timestamp, window.fromTs ?? Infinity);
    const winTo = window.endedAt;
    const head = session.cachedFrames!(wantFrom - 40, wantFrom + 70);
    if (!mine && head.length === 0) return "no-cache";
    const winFrom = mine ? Math.min(mine.fromTs, first.timestamp) : wantFrom;

    let timedOut = false;
    const deadline = t0 + timeoutMs;
    const withTimeout = async (detector: OfflinePoseDetector) => {
      const timer = setTimeout(
        () => {
          timedOut = true;
          detector.cancel();
        },
        Math.max(0, deadline - now()),
      );
      try {
        return await detector.finish();
      } finally {
        clearTimeout(timer);
      }
    };
    let framesMs: number | undefined;
    const detectRange = (fromTs: number, toTs: number) => {
      const detector = session.detectOffline!();
      feed(detector, session.cachedFrames!(fromTs, toTs), 0);
      framesMs ??= now() - t0;
      return withTimeout(detector);
    };

    const guess = deps.span?.(live) ?? null;
    let from = guess
      ? Math.max(winFrom, guess.fromTs - SPAN_MARGIN_MS)
      : winFrom;
    let to = guess ? Math.min(winTo, guess.toTs + SPAN_MARGIN_MS) : winTo;
    if (!(to - from >= MIN_SPAN_MS)) [from, to] = [winFrom, winTo];

    const merge = (dense: LandmarkFrame[]): LandmarkFrame[] => {
      const a = dense[0]?.timestamp ?? Infinity;
      const b = dense.at(-1)?.timestamp ?? -Infinity;
      return [
        ...live.filter((f) => f.timestamp < a),
        ...dense,
        ...live.filter((f) => f.timestamp > b),
      ];
    };

    let dense: LandmarkFrame[] = [];
    let extended = false;
    let earlyFrames = 0;
    try {
      if (mine) {
        // The catch-up started at the trigger: it covers the window from its
        // start; finish it at the span's end.
        early = null;
        mine.off();
        earlyFrames = mine.pushed;
        for (const f of session.cachedFrames!(mine.lastTs + 0.001, to))
          mine.push(f);
        mine.detector.pauseLive?.(true);
        framesMs = now() - t0;
        dense = await withTimeout(mine.detector);
        from = mine.fromTs;
      } else {
        dense = await detectRange(from, to);
      }
      if (guess && dense.length > 0 && !timedOut) {
        const again = deps.span!(merge(dense));
        const lo = dense[0]!.timestamp;
        const hi = dense.at(-1)!.timestamp;
        if (again) {
          if (again.fromTs < lo + SPAN_EDGE_MS && lo > winFrom + 40) {
            const nf = Math.max(
              winFrom,
              Math.min(lo - SPAN_EXTEND_MS, again.fromTs - SPAN_MARGIN_MS),
            );
            dense = [...(await detectRange(nf, lo - 0.001)), ...dense];
            from = nf;
            extended = true;
          }
          if (again.toTs > hi - SPAN_EDGE_MS && hi < winTo - 40 && !timedOut) {
            const nt = Math.min(
              winTo,
              Math.max(hi + SPAN_EXTEND_MS, again.toTs + SPAN_MARGIN_MS),
            );
            dense = [...dense, ...(await detectRange(hi + 0.001, nt))];
            to = nt;
            extended = true;
          }
        }
      }
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err), {
        source: "cache",
      });
    }
    const posed = dense.filter((f) => f.landmarks).length;
    const a = dense[0]?.timestamp ?? from;
    const b = dense.at(-1)?.timestamp ?? to;
    const livePosed = live.filter(
      (f) => f.landmarks && f.timestamp >= a && f.timestamp <= b,
    ).length;
    const span = dense.length > 1 ? (b - a) / 1000 : 0;
    const stats = {
      frames: dense.length,
      posed,
      fps: span > 0 ? (dense.length - 1) / span : null,
      spanMs: Math.round(b - a),
      windowMs: Math.round(winTo - winFrom),
      extended,
      source: "cache" as const,
      earlyFrames,
      ...(framesMs !== undefined ? { framesMs: Math.round(framesMs) } : {}),
    };
    if (posed < Math.max(5, livePosed * minPosedShare))
      return fail(timedOut ? "timed out" : "too few posed frames", stats);
    report({ ok: true, ms: now() - t0, liveFrames: live.length, ...stats });
    return merge(dense).map((f) => ({
      ...f,
      captureTs: f.timestamp + frameToWall,
    }));
  }

  return {
    begin(startedAt, fromTs) {
      dropEarly();
      if (!useCache || !deps.earlyStart || !session.detectOffline) return;
      // Live detection keeps running: it's still watching the shot.
      const detector = session.detectOffline({ pauseLive: false });
      const e = {
        startedAt,
        fromTs,
        detector,
        pushed: 0,
        lastTs: -Infinity,
        off: () => {},
        push(f: CachedFrame) {
          if (f.timestamp <= e.lastTs) return;
          e.lastTs = f.timestamp;
          e.pushed = feed(detector, [f], e.pushed);
        },
      };
      for (const f of session.cachedFrames!(fromTs, Infinity)) e.push(f);
      e.off = session.onCachedFrame!((f) =>
        e.push({ ...f, data: f.data.slice() }),
      );
      early = e;
    },

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
      const mine = early && early.startedAt === window.startedAt ? early : null;
      if (!mine) dropEarly();
      if (!deps.session.detectOffline) return fail("no offline detector");
      const first = live[0];
      const last = live.at(-1);
      if (!first || !last) return fail("empty window");
      if (useCache) {
        const r = await refineFromCache(window, mine, t0, fail);
        if (r !== "no-cache") return r;
      }
      dropEarly();
      if (!recorder?.recording) return fail("no clip recording");
      // Pose clock → performance.now() (the recorder's clock).
      const frameToWall =
        last.captureTs !== undefined ? last.captureTs - last.timestamp : 0;
      // From where the window should start: live tracking may have been
      // paused for part of the pre-roll (the previous rep's re-check), but the
      // recording kept going.
      const wantFrom = Math.min(first.timestamp, window.fromTs ?? Infinity);
      const take = await recorder.takeCovering(wantFrom + frameToWall);
      restart?.();
      if (!take) return fail("no clip");
      stash = { repStartTs: window.startedAt, take };
      const clipStartPose = take.startTs - frameToWall;
      const winFrom = Math.min(
        first.timestamp,
        Math.max(wantFrom, clipStartPose),
      );
      const winTo = window.endedAt;

      let decodeStats: DecodeClipStats | undefined;
      let framesMs: number | undefined;
      let timedOut = false;
      const deadline = t0 + timeoutMs;
      /** Decode + re-detect one stretch of the clip (pose clock, ms). */
      const detectRange = async (
        fromTs: number,
        toTs: number,
      ): Promise<LandmarkFrame[]> => {
        const detector: OfflinePoseDetector = deps.session.detectOffline!();
        let pushed = 0;
        let lastTs = -Infinity;
        const timer = setTimeout(
          () => {
            timedOut = true;
            detector.cancel();
          },
          Math.max(0, deadline - now()),
        );
        try {
          decodeStats = await decode(
            take.blob,
            Math.max(0, (fromTs - clipStartPose) / 1000),
            (toTs - clipStartPose) / 1000,
            (f: DecodedClipFrame) => {
              const ts = Math.max(
                lastTs + 1,
                clipStartPose + f.mediaTime * 1000,
              );
              lastTs = ts;
              detector.push({
                data: f.data,
                width: f.width,
                height: f.height,
                frameIndex: pushed++,
                timestamp: ts,
              });
            },
            { ...deps.decodeOptions, cancelled: () => timedOut },
          );
          framesMs ??= now() - t0;
          return await detector.finish();
        } catch (err) {
          detector.cancel();
          throw err;
        } finally {
          clearTimeout(timer);
        }
      };

      // The scored span, guessed from the live frames (else the whole window).
      const guess = deps.span?.(live) ?? null;
      let from = guess
        ? Math.max(winFrom, guess.fromTs - SPAN_MARGIN_MS)
        : winFrom;
      let to = guess ? Math.min(winTo, guess.toTs + SPAN_MARGIN_MS) : winTo;
      if (!(to - from >= MIN_SPAN_MS)) [from, to] = [winFrom, winTo];

      /** Live frames outside [a, b] around the re-detected ones. */
      const merge = (
        dense: LandmarkFrame[],
        a: number,
        b: number,
      ): LandmarkFrame[] => [
        ...live.filter((f) => f.timestamp < a),
        ...dense,
        ...live.filter((f) => f.timestamp > b),
      ];

      let dense: LandmarkFrame[] = [];
      let extended = false;
      try {
        dense = await detectRange(from, to);
        // A keyframe at an edge of the span: the live guess was off.
        if (guess && dense.length > 0 && !timedOut) {
          const again = deps.span!(merge(dense, from, to));
          if (again) {
            const before = again.fromTs < from + SPAN_EDGE_MS && from > winFrom;
            const after = again.toTs > to - SPAN_EDGE_MS && to < winTo;
            if (before) {
              const nf = Math.max(
                winFrom,
                Math.min(from - SPAN_EXTEND_MS, again.fromTs - SPAN_MARGIN_MS),
              );
              dense = [...(await detectRange(nf, from - 1)), ...dense];
              from = nf;
              extended = true;
            }
            if (after && !timedOut) {
              const nt = Math.min(
                winTo,
                Math.max(to + SPAN_EXTEND_MS, again.toTs + SPAN_MARGIN_MS),
              );
              dense = [...dense, ...(await detectRange(to + 1, nt))];
              to = nt;
              extended = true;
            }
          }
        }
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err), {
          ...(decodeStats ? { decode: decodeStats } : {}),
        });
      }
      const posed = dense.filter((f) => f.landmarks).length;
      const livePosed = live.filter(
        (f) => f.landmarks && f.timestamp >= from && f.timestamp <= to,
      ).length;
      const span =
        dense.length > 1
          ? (dense.at(-1)!.timestamp - dense[0]!.timestamp) / 1000
          : 0;
      const stats = {
        frames: dense.length,
        posed,
        fps: span > 0 ? (dense.length - 1) / span : null,
        spanMs: Math.round(to - from),
        windowMs: Math.round(winTo - winFrom),
        extended,
        ...(decodeStats ? { decode: decodeStats } : {}),
      };
      if (posed < Math.max(5, livePosed * minPosedShare))
        return fail(timedOut ? "timed out" : "too few posed frames", stats);
      report({
        ok: true,
        ms: now() - t0,
        liveFrames: live.length,
        source: "video",
        ...(framesMs !== undefined ? { framesMs: Math.round(framesMs) } : {}),
        ...stats,
      });
      // Same clock mapping as the live frames (the clip is aligned by it).
      return merge(dense, from, to).map((f) => ({
        ...f,
        captureTs: f.timestamp + frameToWall,
      }));
    },
  };
}
