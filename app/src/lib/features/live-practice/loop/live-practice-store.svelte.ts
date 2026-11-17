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
 *   readback  — the worst metrics (or "On target"), shown on the card
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
import {
  selectFocusWorst,
  type MetricDeviation,
  type ShotScorecard,
} from "$lib/features/scoring";
import type {
  CoordinatorEvents,
  LiveRepCoordinator,
} from "../coordinator/coordinator";
import type { LiveShotPipeline } from "../pipeline";
import type { ShotStore } from "../pipeline";
import { buildWorstReadback } from "./readback";

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
  /** Overall deviation score (1..10, lower better), or null when uncovered. */
  overall: number | null;
  worst: readonly MetricDeviation[];
  scorecard: ShotScorecard;
  excluded: boolean;
}

export interface ShotFeedback {
  index: number;
  overall: number | null;
  worst: readonly MetricDeviation[];
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
  dims?: { width?: number; height?: number };
  /** Max worst metrics to read aloud (default 5). */
  maxWorstSpoken?: number;
  /** Live focus-area ids; [] = coach on everything (the default). */
  focusAreas?: string[];
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
  /** Coaching focus (ids); [] = everything. Changeable mid-session. */
  focusAreas = $state<string[]>([]);

  private started = false;
  private unsubscribes: (() => void)[] = [];
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxWorstSpoken: number;
  /** Bumped by pause/stop so an in-flight cycle stops where it is. */
  private generation = 0;

  constructor(private readonly deps: LivePracticeStoreDeps) {
    this.maxWorstSpoken = deps.maxWorstSpoken ?? 5;
    this.muted = deps.audio.isMuted();
    this.focusAreas = deps.focusAreas ?? [];
    this.shots = deps.initialShots ?? [];
  }

  /**
   * Shot detection only starts while the player is positioned (the in-loop
   * gate drives this). See LiveRepCoordinator.setArmed.
   */
  setArmed(armed: boolean): void {
    this.deps.coordinator.setArmed(armed);
  }

  /** Change the coaching focus (applies to the next scored shot). */
  setFocusAreas(ids: string[]): void {
    this.focusAreas = ids;
  }

  /** Mean overall score across included shots (lower is better), or null. */
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

  /** The motion wasn't a shot (nothing was announced): just a quiet flash. */
  private onNoShot(): void {
    this.flashNoShot();
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
    this.cycle = "captured";
    this.feedback = null;
    this.error = null;

    // Announce while the pipeline scores in parallel.
    const announce = (async () => {
      await audio.playEarcon("captured");
      await audio.speak(CAPTURED_TEXT);
      if (this.isStale(gen)) return;
      this.cycle = "analyzing";
      await audio.speak(ANALYZING_TEXT);
    })();

    let result: Awaited<ReturnType<LiveShotPipeline["process"]>> | null = null;
    try {
      const poseData = landmarkFramesToPoseData(
        event.window.frames,
        this.deps.fps,
        this.deps.dims ?? {},
      );
      result = await pipeline.process({
        playerId: this.deps.playerId,
        poseData,
        opts: this.deps.opts,
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
    // Focus steers coaching only: when areas are selected, surface the worst
    // WITHIN them (even if not globally worst); the overall score is untouched.
    const focused =
      this.focusAreas.length > 0
        ? (selectFocusWorst(
            first.scorecard.all,
            this.focusAreas,
            this.maxWorstSpoken,
          ) ?? [])
        : first.worst;

    const entry: ShotEntry = {
      index: this.shots.length + 1,
      shotId: first.shot.id,
      overall: first.scorecard.overall,
      worst: focused,
      scorecard: first.scorecard,
      excluded: false,
    };
    this.shots = [...this.shots, entry];

    const durationFrames =
      first.shot.endFrame !== null && first.shot.startFrame !== null
        ? first.shot.endFrame - first.shot.startFrame + 1
        : undefined;
    let spoken = buildWorstReadback(focused, {
      max: this.maxWorstSpoken,
      ...(durationFrames !== undefined ? { durationFrames } : {}),
    });
    // Audio-first: never fall silent after "Analyzing".
    if (!spoken) {
      spoken = this.focusAreas.length > 0 ? "Focus on target" : ON_TARGET_TEXT;
    }
    this.feedback = {
      index: entry.index,
      overall: entry.overall,
      worst: entry.worst,
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
