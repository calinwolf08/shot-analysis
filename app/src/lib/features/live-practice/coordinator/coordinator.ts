/**
 * LiveRepCoordinator — the per-rep engine for live practice.
 *
 * Pure state machine over a LandmarkFrame stream (no camera, no MediaPipe):
 *
 *   IDLE → READY   pose present & stable for readyPoseMs
 *   READY → ACTIVE upward wrist velocity above riseVelocity, or the wrist
 *                  rising past the head at overheadRiseTorso (rep started)
 *   ACTIVE → ANALYZING  wrist settled for settleMs, or maxRepDurationMs hit
 *                       (quick analysis of the live frames, then — when a
 *                       refine dep is given — of the rep re-detected at full
 *                       frame rate, which replaces the window's frames)
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
  /**
   * EMA factor for wrist velocity smoothing per 30 fps frame (0–1, higher =
   * snappier). Scaled by the actual frame gap, so a phone delivering 10 pose
   * frames/s smooths over the same time span as one delivering 30.
   */
  velocitySmoothing: number;
  /**
   * Second trigger, independent of how big the player is in the frame: the
   * wrist moving up past the head at this many torso lengths per second
   * (smoothed). Catches slower / smaller-in-frame shots that stay under
   * riseVelocity in screen units; dribbles and arm swings stay below the head.
   */
  overheadRiseTorso: number;
  /** Buffer time included before the rep trigger in the analysis window. */
  preRollMs: number;
  /**
   * After setArmed(false), a rep may still START for this long (frame time).
   * The positioning gate can flicker as the player begins the shooting motion;
   * this keeps that flicker from swallowing a real shot.
   */
  disarmGraceMs: number;
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
  overheadRiseTorso: 1.0,
  preRollMs: 1500,
  disarmGraceMs: 750,
};

export type RepTrigger = "settled" | "max-duration";

export interface RepWindow {
  frames: LandmarkFrame[];
  /** Timestamp of the rep trigger (ACTIVE entry). */
  startedAt: number;
  /**
   * Where the window should start (trigger − pre-roll). Later than the first
   * frame's time when live tracking was paused (a re-check of the previous rep
   * holds the pose model): the full-rate re-check decodes that stretch from
   * the recording.
   */
  fromTs?: number;
  /** Timestamp of the last frame in the window. */
  endedAt: number;
  trigger: RepTrigger;
  /** The frames were re-detected at full frame rate (see deps.refine). */
  fullRate?: boolean;
}

export interface CoordinatorEvents {
  stateChanged: { from: CoordinatorState; to: CoordinatorState };
  repStarted: { timestamp: number; cause: "velocity" | "overhead" };
  repAnalyzing: { frameCount: number; trigger: RepTrigger };
  /**
   * The quick analysis of the live frames is done and the full-rate
   * re-detection has started. `quickShots`: shots the quick pass found (a
   * hint; the full-rate pass decides).
   */
  repRefining: { quickShots: number };
  repResult: { analysis: AnalysisResult; window: RepWindow };
  noShot: { window: RepWindow; reason: "no-shot-detected" | "analysis-failed" };
  bufferStats: { frames: number; spanMs: number };
  /**
   * Per-frame diagnostics for the debug HUD. Only computed/emitted when a
   * listener is subscribed, so the hot path stays clean in normal runs.
   */
  debug: {
    timestamp: number;
    state: CoordinatorState;
    posePresent: boolean;
    /** Smoothed upward wrist velocity (normalized units/s). */
    smoothedVelocity: number;
    riseVelocity: number;
    /** Smoothed upward wrist velocity in torso lengths/s (0: no torso). */
    torsoVelocity: number;
    /** Wrist above the head on this frame. */
    wristOverhead: boolean;
    settleVelocity: number;
    /** How long the wrist has been settled while ACTIVE (null otherwise). */
    settledForMs: number | null;
    settleMs: number;
    bufferFrames: number;
    bufferSpanMs: number;
  };
  /**
   * Upward wrist motion got close to (>= 60% of) the rep trigger but never
   * crossed it — the "almost detected a shot" signal.
   */
  nearTrigger: {
    timestamp: number;
    peakVelocity: number;
    riseVelocity: number;
  };
}

export interface LiveRepCoordinator {
  readonly state: CoordinatorState;
  /** Begin consuming frames (IDLE until a pose stabilizes). */
  start(): void;
  pushFrame(frame: LandmarkFrame): void;
  /** FEEDBACK → READY; the UI calls this when the feedback card closes. */
  dismissFeedback(): void;
  /**
   * Gate rep STARTS on the player being positioned (side-on, whole body in
   * frame). Unarmed, upward motion never starts a rep, so motion from the
   * wrong angle is never picked up. A rep already in progress is unaffected.
   * Armed by default (sources with no positioning gate, e.g. replay).
   */
  setArmed(armed: boolean): void;
  readonly armed: boolean;
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
  /**
   * Optional: re-detect the rep window at full frame rate (from its clip).
   * Its frames, when returned, replace the live ones for the analysis and
   * the result. Null = keep the live frames.
   */
  refine?(window: RepWindow): Promise<LandmarkFrame[] | null>;
}

// MediaPipe pose landmark indexes.
const WRIST_INDEX = { left: 15, right: 16 } as const;
const NOSE = 0;
const SHOULDERS = [11, 12] as const;
const HIPS = [23, 24] as const;
/** Frame gap the velocitySmoothing factor is defined for (30 fps). */
const REF_FRAME_SEC = 1 / 30;

type Landmarks = NonNullable<LandmarkFrame["landmarks"]>;

/** Mid-shoulder → mid-hip length (normalized), or null when not tracked. */
function torsoLength(l: Landmarks): number | null {
  const s1 = l[SHOULDERS[0]];
  const s2 = l[SHOULDERS[1]];
  const h1 = l[HIPS[0]];
  const h2 = l[HIPS[1]];
  if (!s1 || !s2 || !h1 || !h2) return null;
  const len = Math.hypot(
    (s1.x + s2.x) / 2 - (h1.x + h2.x) / 2,
    (s1.y + s2.y) / 2 - (h1.y + h2.y) / 2,
  );
  return len > 0.02 ? len : null;
}

/** Head height (screen y): the nose, else half a torso above the shoulders. */
function headY(l: Landmarks, torso: number | null): number | null {
  const nose = l[NOSE];
  if (nose && nose.visibility >= 0.3) return nose.y;
  const s1 = l[SHOULDERS[0]];
  const s2 = l[SHOULDERS[1]];
  if (!s1 || !s2 || torso === null) return null;
  return (s1.y + s2.y) / 2 - 0.5 * torso;
}

/** Fraction of riseVelocity that counts as a near-miss worth reporting. */
const NEAR_TRIGGER_RATIO = 0.6;
/** A near-miss is reported once the motion faded or this much time passed. */
const NEAR_TRIGGER_WINDOW_MS = 1200;

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
  let torsoVelocity = 0;
  let wristOverhead = false;
  let repStartTs = 0;
  let settledSince: number | null = null;
  let lastRepEndTs = -Infinity;
  let nearPeak = 0;
  let nearPeakTs = 0;
  let armed = true;
  let lastFrameTs = 0;
  /** Frame time when the coordinator was last disarmed (grace window). */
  let disarmedAtTs: number | null = null;

  function mayStartRep(now: number): boolean {
    if (armed) return true;
    return disarmedAtTs !== null && now - disarmedAtTs < cfg.disarmGraceMs;
  }

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
    torsoVelocity = 0;
    wristOverhead = false;
    settledSince = null;
    nearPeak = 0;
  }

  /**
   * While READY, remembers the highest sub-trigger upward velocity and
   * reports it as a near-miss once the motion fades (or times out) without
   * a rep starting.
   */
  function trackNearTrigger(now: number) {
    if (
      smoothedVelocity >= cfg.riseVelocity * NEAR_TRIGGER_RATIO &&
      smoothedVelocity > nearPeak
    ) {
      nearPeak = smoothedVelocity;
      nearPeakTs = now;
    }
    if (
      nearPeak > 0 &&
      (smoothedVelocity < nearPeak / 2 ||
        now - nearPeakTs >= NEAR_TRIGGER_WINDOW_MS)
    ) {
      emit("nearTrigger", {
        timestamp: now,
        peakVelocity: nearPeak,
        riseVelocity: cfg.riseVelocity,
      });
      nearPeak = 0;
    }
  }

  function posePresent(frame: LandmarkFrame): boolean {
    return (
      frame.landmarks !== null && frame.poseConfidence >= cfg.minPoseConfidence
    );
  }

  /** Updates the smoothed upward wrist velocity (positive = rising). */
  function trackWrist(frame: LandmarkFrame) {
    const l = frame.landmarks;
    const wrist = l?.[wristIndex];
    if (!l || !wrist) return;
    const torso = torsoLength(l);
    const head = headY(l, torso);
    wristOverhead = head !== null && wrist.y < head;
    if (prevWrist) {
      const dtSec = (frame.timestamp - prevWrist.timestamp) / 1000;
      // A long gap (pose dropout) makes the derivative meaningless.
      if (dtSec > 0 && dtSec < 0.5) {
        const velocity = -(wrist.y - prevWrist.y) / dtSec; // screen y is down
        // Same smoothing time span whatever the pose frame rate.
        const a =
          1 - Math.pow(1 - cfg.velocitySmoothing, dtSec / REF_FRAME_SEC);
        smoothedVelocity = a * velocity + (1 - a) * smoothedVelocity;
        torsoVelocity =
          torso !== null ? a * (velocity / torso) + (1 - a) * torsoVelocity : 0;
      } else {
        smoothedVelocity = 0;
        torsoVelocity = 0;
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
      fromTs: windowStart,
      endedAt: frames.at(-1)?.timestamp ?? now,
      trigger,
    };
    lastRepEndTs = window.endedAt;
    settledSince = null;
    setState("ANALYZING");
    emit("repAnalyzing", { frameCount: frames.length, trigger });

    const myGeneration = generation;
    const stale = () => generation !== myGeneration || state !== "ANALYZING";
    void (async () => {
      let analysis = await deps.analyze(frames);
      let final = window;
      if (deps.refine && !stale()) {
        emit("repRefining", { quickShots: analysis.shots.length });
        const full = await deps.refine(window).catch(() => null);
        if (stale()) return null;
        if (full && full.length > 0) {
          final = { ...window, frames: full, fullRate: true };
          analysis = await deps.analyze(full);
        }
      }
      return { analysis, final };
    })()
      .then((r) => {
        if (!r || stale()) return;
        const { analysis, final } = r;
        if (analysis.shots.length > 0) {
          setState("FEEDBACK");
          emit("repResult", { analysis, window: final });
        } else {
          setState("READY");
          emit("noShot", { window: final, reason: "no-shot-detected" });
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

    get armed() {
      return armed;
    },

    setArmed(next) {
      if (next === armed) return;
      armed = next;
      disarmedAtTs = next ? null : lastFrameTs;
    },

    pushFrame(frame) {
      if (!running) return;
      const now = frame.timestamp;
      lastFrameTs = now;

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
          const cause =
            smoothedVelocity >= cfg.riseVelocity
              ? "velocity"
              : wristOverhead && torsoVelocity >= cfg.overheadRiseTorso
                ? "overhead"
                : null;
          if (
            cause !== null &&
            now - lastRepEndTs >= cfg.minRepGapMs &&
            mayStartRep(now)
          ) {
            repStartTs = now;
            settledSince = null;
            nearPeak = 0; // triggered — not a near-miss
            setState("ACTIVE");
            emit("repStarted", { timestamp: now, cause });
            break;
          }
          trackNearTrigger(now);
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

      if (listeners.get("debug")?.size) {
        emit("debug", {
          timestamp: now,
          state,
          posePresent: present,
          smoothedVelocity,
          riseVelocity: cfg.riseVelocity,
          torsoVelocity,
          wristOverhead,
          settleVelocity: cfg.settleVelocity,
          settledForMs:
            state === "ACTIVE" && settledSince !== null
              ? now - settledSince
              : null,
          settleMs: cfg.settleMs,
          bufferFrames: buffer.length,
          bufferSpanMs: now - buffer[0]!.timestamp,
        });
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
