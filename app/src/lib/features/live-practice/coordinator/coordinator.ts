/**
 * LiveRepCoordinator — the per-rep engine for live practice.
 *
 * Pure state machine over a LandmarkFrame stream (no camera, no MediaPipe):
 *
 *   IDLE → READY   pose present & stable for readyPoseMs
 *   READY → ACTIVE upward wrist velocity above riseVelocity (rep started)
 *   ACTIVE → ANALYZING  wrist settled for settleMs, or maxRepDurationMs hit
 *   ANALYZING → FEEDBACK  analysis found a shot (repResult)
 *   ANALYZING → READY     no shot in the window (noShot)
 *   FEEDBACK → READY      dismissFeedback() (UI auto-dismiss)
 *
 * All timing derives from frame timestamps, so replayed streams produce
 * identical transitions regardless of wall-clock speed.
 */
import type { AnalysisResult } from "basketball-shot-analysis";
import type { LandmarkFrame } from "$lib/features/analysis";

export type CoordinatorState =
  | "IDLE"
  | "READY"
  | "ACTIVE"
  | "ANALYZING"
  | "FEEDBACK";

export interface LiveRepConfig {
  shootingHand: "left" | "right";
  /** Wrist must stay below settleVelocity this long to end a rep. */
  settleMs: number;
  /** Ignore new rep triggers this long after the previous rep ended. */
  minRepGapMs: number;
  /** Force analysis if a rep runs longer than this. */
  maxRepDurationMs: number;
  /** Rolling landmark buffer span. */
  bufferMs: number;
  /** Pose must be continuously present this long for IDLE → READY. */
  readyPoseMs: number;
  /** Pose absent this long mid-rep aborts the rep (graceful reset). */
  poseLossMs: number;
  minPoseConfidence: number;
  /** Smoothed upward wrist velocity (normalized units/s) starting a rep. */
  riseVelocity: number;
  /** |velocity| below this counts as settled. */
  settleVelocity: number;
  /** EMA factor for wrist velocity smoothing (0–1, higher = snappier). */
  velocitySmoothing: number;
  /** Buffer time included before the rep trigger in the analysis window. */
  preRollMs: number;
}

export const DEFAULT_LIVE_REP_CONFIG: Omit<LiveRepConfig, "shootingHand"> = {
  settleMs: 900,
  minRepGapMs: 1200,
  maxRepDurationMs: 6000,
  bufferMs: 12_000,
  readyPoseMs: 800,
  poseLossMs: 1000,
  minPoseConfidence: 0.5,
  riseVelocity: 0.35,
  settleVelocity: 0.08,
  velocitySmoothing: 0.4,
  preRollMs: 1500,
};

export type RepTrigger = "settled" | "max-duration";

export interface RepWindow {
  frames: LandmarkFrame[];
  /** Timestamp of the rep trigger (ACTIVE entry). */
  startedAt: number;
  /** Timestamp of the last frame in the window. */
  endedAt: number;
  trigger: RepTrigger;
}

export interface CoordinatorEvents {
  stateChanged: { from: CoordinatorState; to: CoordinatorState };
  repStarted: { timestamp: number };
  repAnalyzing: { frameCount: number; trigger: RepTrigger };
  repResult: { analysis: AnalysisResult; window: RepWindow };
  noShot: { window: RepWindow; reason: "no-shot-detected" | "analysis-failed" };
  bufferStats: { frames: number; spanMs: number };
}

export interface LiveRepCoordinator {
  readonly state: CoordinatorState;
  /** Begin consuming frames (IDLE until a pose stabilizes). */
  start(): void;
  pushFrame(frame: LandmarkFrame): void;
  /** FEEDBACK → READY; the UI calls this when the feedback card closes. */
  dismissFeedback(): void;
  /** Back to IDLE; clears the buffer and voids any in-flight analysis. */
  stop(): void;
  on<K extends keyof CoordinatorEvents>(
    event: K,
    cb: (payload: CoordinatorEvents[K]) => void,
  ): () => void;
}

export interface LiveRepCoordinatorDeps {
  /** Full shot detection + metrics over the buffered rep window. */
  analyze(frames: readonly LandmarkFrame[]): Promise<AnalysisResult>;
}

// MediaPipe pose landmark indexes.
const WRIST_INDEX = { left: 15, right: 16 } as const;

export function createLiveRepCoordinator(
  deps: LiveRepCoordinatorDeps,
  config: Partial<LiveRepConfig> & Pick<LiveRepConfig, "shootingHand">,
): LiveRepCoordinator {
  const cfg: LiveRepConfig = { ...DEFAULT_LIVE_REP_CONFIG, ...config };
  const wristIndex = WRIST_INDEX[cfg.shootingHand];

  const listeners = new Map<keyof CoordinatorEvents, Set<(p: never) => void>>();
  function emit<K extends keyof CoordinatorEvents>(
    event: K,
    payload: CoordinatorEvents[K],
  ) {
    const set = listeners.get(event);
    if (!set) return;
    for (const cb of set) (cb as (p: CoordinatorEvents[K]) => void)(payload);
  }

  let state: CoordinatorState = "IDLE";
  let running = false;
  /** Bumped on stop() so stale analysis resolutions are discarded. */
  let generation = 0;

  let buffer: LandmarkFrame[] = [];
  let poseStableSince: number | null = null;
  let lastPoseTs: number | null = null;
  let prevWrist: { y: number; timestamp: number } | null = null;
  let smoothedVelocity = 0;
  let repStartTs = 0;
  let settledSince: number | null = null;
  let lastRepEndTs = -Infinity;

  function setState(to: CoordinatorState) {
    if (state === to) return;
    const from = state;
    state = to;
    emit("stateChanged", { from, to });
  }

  function resetMotionTracking() {
    poseStableSince = null;
    lastPoseTs = null;
    prevWrist = null;
    smoothedVelocity = 0;
    settledSince = null;
  }

  function posePresent(frame: LandmarkFrame): boolean {
    return (
      frame.landmarks !== null && frame.poseConfidence >= cfg.minPoseConfidence
    );
  }

  /** Updates the smoothed upward wrist velocity (positive = rising). */
  function trackWrist(frame: LandmarkFrame) {
    const wrist = frame.landmarks?.[wristIndex];
    if (!wrist) return;
    if (prevWrist) {
      const dtSec = (frame.timestamp - prevWrist.timestamp) / 1000;
      // A long gap (pose dropout) makes the derivative meaningless.
      if (dtSec > 0 && dtSec < 0.5) {
        const velocity = -(wrist.y - prevWrist.y) / dtSec; // screen y is down
        smoothedVelocity =
          cfg.velocitySmoothing * velocity +
          (1 - cfg.velocitySmoothing) * smoothedVelocity;
      } else {
        smoothedVelocity = 0;
      }
    }
    prevWrist = { y: wrist.y, timestamp: frame.timestamp };
  }

  function beginAnalysis(trigger: RepTrigger, now: number) {
    const windowStart = repStartTs - cfg.preRollMs;
    const frames = buffer.filter((f) => f.timestamp >= windowStart);
    const window: RepWindow = {
      frames,
      startedAt: repStartTs,
      endedAt: frames.at(-1)?.timestamp ?? now,
      trigger,
    };
    lastRepEndTs = window.endedAt;
    settledSince = null;
    setState("ANALYZING");
    emit("repAnalyzing", { frameCount: frames.length, trigger });

    const myGeneration = generation;
    void deps
      .analyze(frames)
      .then((analysis) => {
        if (generation !== myGeneration || state !== "ANALYZING") return;
        if (analysis.shots.length > 0) {
          setState("FEEDBACK");
          emit("repResult", { analysis, window });
        } else {
          setState("READY");
          emit("noShot", { window, reason: "no-shot-detected" });
        }
      })
      .catch(() => {
        if (generation !== myGeneration || state !== "ANALYZING") return;
        setState("READY");
        emit("noShot", { window, reason: "analysis-failed" });
      });
  }

  return {
    get state() {
      return state;
    },

    start() {
      running = true;
    },

    pushFrame(frame) {
      if (!running) return;
      const now = frame.timestamp;

      buffer.push(frame);
      const cutoff = now - cfg.bufferMs;
      while (buffer.length > 0 && buffer[0]!.timestamp < cutoff) {
        buffer.shift();
      }
      emit("bufferStats", {
        frames: buffer.length,
        spanMs: now - buffer[0]!.timestamp,
      });

      const present = posePresent(frame);
      if (present) {
        lastPoseTs = now;
        trackWrist(frame);
      }

      switch (state) {
        case "IDLE": {
          if (present) {
            poseStableSince ??= now;
            if (now - poseStableSince >= cfg.readyPoseMs) setState("READY");
          } else {
            poseStableSince = null;
          }
          break;
        }

        case "READY": {
          if (!present) {
            if (lastPoseTs !== null && now - lastPoseTs >= cfg.poseLossMs) {
              resetMotionTracking();
              setState("IDLE");
            }
            break;
          }
          if (
            smoothedVelocity >= cfg.riseVelocity &&
            now - lastRepEndTs >= cfg.minRepGapMs
          ) {
            repStartTs = now;
            settledSince = null;
            setState("ACTIVE");
            emit("repStarted", { timestamp: now });
          }
          break;
        }

        case "ACTIVE": {
          if (!present) {
            if (lastPoseTs !== null && now - lastPoseTs >= cfg.poseLossMs) {
              // Pose lost mid-rep: graceful reset, no analysis.
              resetMotionTracking();
              setState("IDLE");
            }
            break;
          }
          if (now - repStartTs >= cfg.maxRepDurationMs) {
            beginAnalysis("max-duration", now);
            break;
          }
          if (Math.abs(smoothedVelocity) < cfg.settleVelocity) {
            settledSince ??= now;
            if (now - settledSince >= cfg.settleMs) {
              beginAnalysis("settled", now);
            }
          } else {
            settledSince = null;
          }
          break;
        }

        case "ANALYZING":
        case "FEEDBACK":
          // Frames keep buffering; transitions wait for the analysis
          // resolution / feedback dismissal.
          break;
      }
    },

    dismissFeedback() {
      if (state === "FEEDBACK") setState("READY");
    },

    on(event, cb) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(cb as (p: never) => void);
      return () => set.delete(cb as (p: never) => void);
    },

    stop() {
      running = false;
      generation += 1;
      buffer = [];
      resetMotionTracking();
      setState("IDLE");
    },
  };
}
