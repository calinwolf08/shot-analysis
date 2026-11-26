/**
 * LivePracticeStore — the continuous, session-less live practice loop
 * (live redesign — step 5). Replaces LiveSessionStore.
 *
 * Binds the LiveRepCoordinator to the swappable analysis pipeline (on-device by
 * default, server when configured — see ./pipeline). There is no "session": the
 * user practices continuously and every shot is persisted rooted on the player.
 * Each shot runs one strictly ordered, audio-first cycle (the player mostly
 * listens; the screen mirrors it for a spotter):
 *
 *   captured  — "captured" earcon + "Shot captured"
 *   analyzing — "Analyzing" (the pipeline scores in parallel)
 *   readback  — the 3 worst enabled checks (one per body part), in shot
 *               order, in the same words as the card ("At release: hands too
 *               low by 1.") — or "On target"
 *   tracking  — "ready" earcon, then shot detection resumes
 *
 * Each step waits for the previous sound to FINISH, and the coordinator stays
 * in FEEDBACK (no new shot can start) until the ready earcon — so a new shot
 * is never picked up mid-feedback. There is no fixed pause: tracking resumes
 * as soon as the readback has been heard.
 *
 * The scorecard is produced by the pipeline and shown/stored as measurements
 * (recomputed on read elsewhere); this store only orchestrates the live loop.
 *
 * @see docs/live-redesign-plan.md §3.6
 */
import type { AnalyzeOptions } from "$lib/features/analysis";
import { landmarkFramesToPoseData } from "$lib/features/analysis/replay/replay-pipeline";
import type { AudioFeedbackService } from "$lib/shared/audio";
import type { KeyframeTargets } from "basketball-shot-analysis";
import {
  FEEDBACK_COUNT,
  feedbackChecks,
  scoreShotKeyframes,
  spokenReadback,
  type CheckResult,
  type KeyframeScorecard,
} from "$lib/features/scoring/keyframes";
import type { StoredShotAnalysis } from "$lib/features/analysis/replay/replay-pipeline";
import type {
  CoordinatorEvents,
  LiveRepCoordinator,
} from "../coordinator/coordinator";
import type { LiveShotPipeline } from "../pipeline";
import type { ShotStore } from "../pipeline";

/** Spoken when a detected shot is rejected for the camera angle. */
export const WRONG_ANGLE_TEXT = "Wrong angle, shot not counted";
export const CAPTURED_TEXT = "Shot captured";
export const ANALYZING_TEXT = "Analyzing";
/** Spoken when nothing (in focus) is off target. */
export const ON_TARGET_TEXT = "On target";
/** Spoken when the pipeline couldn't score a captured shot. */
export const NOT_SCORED_TEXT = "Shot not scored";

/** Where the per-shot announcement cycle is (drives the status strip). */
export type ShotCycle = "tracking" | "captured" | "analyzing" | "readback";

export type LoopPhase =
  | "idle"
  | "ready"
  | "active"
  | "analyzing"
  | "feedback"
  | "paused";

export interface ShotEntry {
  /** 1-based position in the continuous history. */
  index: number;
  shotId: string;
  /** Overall score (0 = on target … 10+), or null when not enough measured. */
  overall: number | null;
  /** Off-target enabled checks, worst first. */
  worst: readonly CheckResult[];
  /** Scored with the player's feedback filter (turned-off checks left out). */
  scorecard: KeyframeScorecard;
  excluded: boolean;
  /**
   * When the rep started (pose-frame clock, ms) and the offset from that clock
   * to performance.now() — lets the clip recorder pick and align the video.
   * Absent for shots loaded from history.
   */
  capture?: {
    repStartTs: number;
    /** First frame of the rep window (pose-frame clock, ms). */
    windowStartTs?: number;
    frameToWall: number;
  };
}

export interface ShotFeedback {
  index: number;
  overall: number | null;
  /** The items fed back: the worst N (one per body part), in shot order. */
  worst: readonly CheckResult[];
  /** The text spoken for this shot (empty when nothing was off-target). */
  spoken: string;
}

export interface LivePracticeStoreDeps {
  coordinator: LiveRepCoordinator;
  pipeline: LiveShotPipeline;
  /** Persistence for the "not a shot" affordance (exclude/include). */
  shotStore: ShotStore;
  audio: AudioFeedbackService;
  playerId: string;
  /** Analysis options for the player (shooting hand + profile). */
  opts: AnalyzeOptions;
  /** Frame rate of the rep windows, to reconstruct PoseData. */
  fps: number;
  /** Pixel size of the pose frames (stored with each shot for review). */
  frameSize?: () => { width: number; height: number } | null;
  /** Max checks fed back (default 3). */
  maxWorstSpoken?: number;
  /** Keyframe targets (to score each shot with the feedback filter). */
  targets: KeyframeTargets;
  /** Feedback filter: enabled check ids; null = every check (the default). */
  enabled?: ReadonlySet<string> | null;
  /** Shots already recorded today (continues the counter/average). */
  initialShots?: ShotEntry[];
}

export class LivePracticeStore {
  phase = $state<LoopPhase>("idle");
  /** Shot detection is running (start() called, not stopped). */
  running = $state(false);
  /** Per-shot announcement cycle; "tracking" between shots. */
  cycle = $state<ShotCycle>("tracking");
  /** The continuous shot history (most recent last). */
  shots = $state<ShotEntry[]>([]);
  /** The latest shot's feedback; stays up until the next shot. */
  feedback = $state<ShotFeedback | null>(null);
  noShotFlash = $state(false);
  /** A detected shot was rejected for the camera angle (brief flash). */
  wrongAngleFlash = $state(false);
  muted = $state(false);
  error = $state<string | null>(null);
  /** Feedback filter (enabled check ids; null = all). Changeable mid-session. */
  enabled = $state.raw<ReadonlySet<string> | null>(null);

  private started = false;
  private unsubscribes: (() => void)[] = [];
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxWorstSpoken: number;
  /** Bumped by pause/stop so an in-flight cycle stops where it is. */
  private generation = 0;
  /**
   * "Shot captured / Analyzing", started while the shot is still being
   * re-detected at full frame rate (the quick pass already saw a shot), so
   * the player hears it straight away; the score only comes from the
   * full-rate result.
   */
  private earlyAnnounce: { gen: number; done: Promise<void> } | null = null;

  constructor(private readonly deps: LivePracticeStoreDeps) {
    this.maxWorstSpoken = deps.maxWorstSpoken ?? FEEDBACK_COUNT;
    this.muted = deps.audio.isMuted();
    this.enabled = deps.enabled ?? null;
    this.shots = deps.initialShots ?? [];
  }

  /**
   * Shot detection only starts while the player is positioned (the in-loop
   * gate drives this). See LiveRepCoordinator.setArmed.
   */
  setArmed(armed: boolean): void {
    this.deps.coordinator.setArmed(armed);
  }

  /** Change the feedback filter (applies to the next scored shot). */
  setEnabled(enabled: ReadonlySet<string> | null): void {
    this.enabled = enabled;
  }

  /** Mean overall score across included shots (0 = on target), or null. */
  get average(): number | null {
    const scores = this.shots
      .filter((s) => !s.excluded && s.overall !== null)
      .map((s) => s.overall!);
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  get shotCount(): number {
    return this.shots.filter((s) => !s.excluded).length;
  }

  /** Begins the loop. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.running = true;
    const { coordinator } = this.deps;
    this.unsubscribes = [
      coordinator.on("stateChanged", ({ to }) => {
        if (this.phase === "paused") return;
        this.phase = to.toLowerCase() as LoopPhase;
      }),
      coordinator.on("repAnalyzing", () => this.onAnalyzing()),
      coordinator.on("repRefining", ({ quickShots }) => {
        if (quickShots > 0) this.announceEarly();
      }),
      coordinator.on("repResult", (event) => {
        void this.runShotCycle(event);
      }),
      coordinator.on("noShot", () => this.onNoShot()),
    ];
    coordinator.start();
    this.phase = "ready";
  }

  /** A rep ended and is being checked: cut off any positioning cue. */
  private onAnalyzing(): void {
    this.deps.audio.cancel();
  }

  private announcement(gen: number): Promise<void> {
    const { audio } = this.deps;
    return (async () => {
      await audio.playEarcon("captured");
      await audio.speak(CAPTURED_TEXT);
      if (this.isStale(gen)) return;
      this.cycle = "analyzing";
      await audio.speak(ANALYZING_TEXT);
    })();
  }

  private announceEarly(): void {
    const gen = this.generation;
    this.cycle = "captured";
    this.feedback = null;
    this.error = null;
    this.earlyAnnounce = { gen, done: this.announcement(gen) };
  }

  /**
   * The motion wasn't a shot: a quiet flash — unless "Shot captured" was
   * already said (the quick pass saw a shot the full-rate pass didn't).
   */
  private onNoShot(): void {
    const early = this.earlyAnnounce;
    this.earlyAnnounce = null;
    if (!early || early.gen !== this.generation) {
      this.flashNoShot();
      return;
    }
    const gen = this.generation;
    void (async () => {
      await early.done;
      if (this.isStale(gen)) return;
      this.flash("no-shot");
      await this.deps.audio.speak(NOT_SCORED_TEXT);
      if (this.isStale(gen)) return;
      this.cycle = "tracking";
    })();
  }

  private isStale(gen: number): boolean {
    return gen !== this.generation || !this.started;
  }

  /**
   * One shot, start to finish. The coordinator is in FEEDBACK for the whole
   * cycle, so no new shot can begin until `finishCycle` releases it.
   */
  private async runShotCycle(
    event: CoordinatorEvents["repResult"],
  ): Promise<void> {
    const gen = this.generation;
    const { pipeline, audio } = this.deps;
    const early =
      this.earlyAnnounce?.gen === gen ? this.earlyAnnounce.done : null;
    this.earlyAnnounce = null;
    if (!early) {
      this.cycle = "captured";
      this.feedback = null;
      this.error = null;
    }

    // Announce while the pipeline scores in parallel.
    const announce = early ?? this.announcement(gen);

    let result: Awaited<ReturnType<LiveShotPipeline["process"]>> | null = null;
    try {
      const poseData = landmarkFramesToPoseData(
        event.window.frames,
        this.deps.fps,
        this.deps.frameSize?.() ?? {},
      );
      // The rep's trigger, as an index into the posed frames the analysis
      // sees (frames with no pose are dropped there).
      const focusIndex = event.window.frames.filter(
        (f) => f.landmarks !== null && f.timestamp < event.window.startedAt,
      ).length;
      // Pre-roll with no frames: live tracking paused and the re-check
      // couldn't fill it from the recording.
      const first = event.window.frames[0]?.timestamp;
      const missedStartMs =
        first !== undefined && event.window.fromTs !== undefined
          ? Math.max(0, first - event.window.fromTs)
          : 0;
      result = await pipeline.process({
        playerId: this.deps.playerId,
        poseData,
        opts: this.deps.opts,
        focusIndex,
        missedStartMs,
      });
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
    await announce;
    if (this.isStale(gen)) return;

    if (!result || result.shots.length === 0) {
      if (result && result.rejected.length > 0) {
        this.flash("wrong-angle");
        await audio.speak(WRONG_ANGLE_TEXT);
      } else {
        this.flash("no-shot");
        await audio.speak(NOT_SCORED_TEXT);
      }
      await this.finishCycle(gen);
      return;
    }

    const first = result.shots[0]!;
    // The feedback filter applies to everything: turned-off checks are left
    // out of the score, the card and the voice.
    const checks = (first.shot.analysis as StoredShotAnalysis).keyframes;
    const card = checks
      ? scoreShotKeyframes(checks, this.deps.targets, this.enabled)
      : first.scorecard;

    const last = event.window.frames.at(-1);
    const entry: ShotEntry = {
      index: this.shots.length + 1,
      shotId: first.shot.id,
      overall: card.overall,
      worst: card.worst,
      scorecard: card,
      excluded: false,
      capture: {
        repStartTs: event.window.startedAt,
        windowStartTs: event.window.frames[0]?.timestamp,
        frameToWall:
          last?.captureTs !== undefined ? last.captureTs - last.timestamp : 0,
      },
    };
    this.shots = [...this.shots, entry];

    const items = feedbackChecks(card, this.maxWorstSpoken);
    let spoken = spokenReadback(items);
    // Audio-first: never fall silent after "Analyzing".
    if (!spoken) {
      spoken = this.enabled ? "Focus on target" : ON_TARGET_TEXT;
    }
    this.feedback = {
      index: entry.index,
      overall: entry.overall,
      // The same items that were spoken: worst N, in shot order.
      worst: items,
      spoken,
    };
    this.cycle = "readback";
    await audio.speak(spoken);
    await this.finishCycle(gen);
  }

  /** Ready earcon, then resume shot detection. */
  private async finishCycle(gen: number): Promise<void> {
    if (this.isStale(gen)) return;
    await this.deps.audio.playEarcon("ready");
    if (this.isStale(gen)) return;
    this.cycle = "tracking";
    this.deps.coordinator.dismissFeedback();
  }

  private flash(kind: "wrong-angle" | "no-shot"): void {
    this.wrongAngleFlash = kind === "wrong-angle";
    this.noShotFlash = kind === "no-shot";
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(
      () => {
        this.wrongAngleFlash = false;
        this.noShotFlash = false;
      },
      kind === "wrong-angle" ? 2500 : 1500,
    );
  }

  private flashNoShot(): void {
    this.flash("no-shot");
  }

  /** Hides the feedback card (tracking is unaffected). */
  clearFeedback(): void {
    this.feedback = null;
  }

  /** "Not a shot?" — excludes the shot, re-averages, cuts its readback. */
  async excludeShot(index: number): Promise<void> {
    const entry = this.shots.find((s) => s.index === index);
    if (!entry || entry.excluded) return;
    await this.deps.shotStore.setExcluded(entry.shotId, true);
    this.shots = this.shots.map((s) =>
      s.index === index ? { ...s, excluded: true } : s,
    );
    if (this.feedback?.index === index) {
      // Ends the readback early; the cycle continues to "ready".
      if (this.cycle === "readback") this.deps.audio.cancel();
      this.clearFeedback();
    }
  }

  /** Abandon any in-flight cycle (pause/stop). */
  private abortCycle(): void {
    this.generation += 1;
    this.earlyAnnounce = null;
    this.cycle = "tracking";
    this.deps.audio.cancel();
  }

  pause(): void {
    if (this.phase === "paused") return;
    this.abortCycle();
    this.clearFeedback();
    this.deps.coordinator.stop();
    this.phase = "paused";
  }

  resume(): void {
    if (this.phase !== "paused") return;
    this.deps.coordinator.start();
    this.phase = "ready";
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.deps.audio.setMuted(this.muted);
    if (this.muted) this.deps.audio.cancel();
  }

  /** Tears down subscriptions + the coordinator (leaving the screen). */
  stop(): void {
    this.abortCycle();
    this.clearFeedback();
    this.deps.coordinator.stop();
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];
    this.started = false;
    this.running = false;
  }
}
