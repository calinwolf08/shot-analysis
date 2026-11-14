/**
 * LivePracticeStore — the continuous, session-less live practice loop
 * (live redesign — step 5). Replaces LiveSessionStore.
 *
 * Binds the LiveRepCoordinator to the swappable analysis pipeline (on-device by
 * default, server when configured — see ./pipeline). There is no "session": the
 * user practices continuously and every shot is persisted rooted on the player.
 * Each shot is bracketed by audio: an "analyzing" earcon when the shot is
 * recognized (which also interrupts any prior readback), the 5-worst terse
 * readback, then a "ready" earcon for the next shot.
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
  /** Feedback card auto-dismiss (wall-clock ms). */
  feedbackMs?: number;
  /** Max worst metrics to read aloud (default 5). */
  maxWorstSpoken?: number;
  /** Live focus-area ids; [] = coach on everything (the default). */
  focusAreas?: string[];
}

export class LivePracticeStore {
  phase = $state<LoopPhase>("idle");
  /** The continuous shot history (most recent last). */
  shots = $state<ShotEntry[]>([]);
  feedback = $state<ShotFeedback | null>(null);
  noShotFlash = $state(false);
  muted = $state(false);
  error = $state<string | null>(null);
  /** Coaching focus (ids); [] = everything. Changeable mid-session. */
  focusAreas = $state<string[]>([]);

  private started = false;
  private unsubscribes: (() => void)[] = [];
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly feedbackMs: number;
  private readonly maxWorstSpoken: number;

  constructor(private readonly deps: LivePracticeStoreDeps) {
    this.feedbackMs = deps.feedbackMs ?? 4000;
    this.maxWorstSpoken = deps.maxWorstSpoken ?? 5;
    this.muted = deps.audio.isMuted();
    this.focusAreas = deps.focusAreas ?? [];
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

  /** Begins the loop. Caller gates this behind the angle check. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const { coordinator } = this.deps;
    this.unsubscribes = [
      coordinator.on("stateChanged", ({ to }) => {
        if (this.phase === "paused") return;
        this.phase = to.toLowerCase() as LoopPhase;
      }),
      coordinator.on("repAnalyzing", () => this.onAnalyzing()),
      coordinator.on("repResult", (event) => {
        void this.handleRepResult(event);
      }),
      coordinator.on("noShot", () => this.onNoShot()),
    ];
    coordinator.start();
    this.phase = "ready";
  }

  /** Shot recognized → interrupt any prior readback and signal "analyzing". */
  private onAnalyzing(): void {
    this.deps.audio.cancel();
    this.deps.audio.playEarcon("analyzing");
  }

  private onNoShot(): void {
    this.flashNoShot();
    this.deps.audio.playEarcon("ready");
  }

  private async handleRepResult(
    event: CoordinatorEvents["repResult"],
  ): Promise<void> {
    const { pipeline, audio } = this.deps;
    try {
      const poseData = landmarkFramesToPoseData(
        event.window.frames,
        this.deps.fps,
        this.deps.dims ?? {},
      );
      const processed = await pipeline.process({
        playerId: this.deps.playerId,
        poseData,
        opts: this.deps.opts,
      });
      if (processed.length === 0) {
        this.onNoShot();
        return;
      }
      const first = processed[0]!;
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
      // With a focus set and nothing off-target in it, acknowledge rather than
      // fall silent (silence would read as "no feedback").
      if (!spoken && this.focusAreas.length > 0) spoken = "Focus on target";
      // onAnalyzing already cancelled prior speech; read, then signal ready.
      if (spoken) audio.speak(spoken);
      audio.playEarcon("ready");

      this.feedback = {
        index: entry.index,
        overall: entry.overall,
        worst: entry.worst,
        spoken,
      };
      this.dismissTimer = setTimeout(
        () => this.dismissFeedback(),
        this.feedbackMs,
      );
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      this.deps.audio.playEarcon("ready");
      this.dismissFeedback();
    }
  }

  private flashNoShot(): void {
    this.noShotFlash = true;
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => (this.noShotFlash = false), 1500);
  }

  dismissFeedback(): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    this.feedback = null;
    this.deps.coordinator.dismissFeedback();
  }

  /** "Not a shot?" — excludes the shot and re-averages. */
  async excludeShot(index: number): Promise<void> {
    const entry = this.shots.find((s) => s.index === index);
    if (!entry || entry.excluded) return;
    await this.deps.shotStore.setExcluded(entry.shotId, true);
    this.shots = this.shots.map((s) =>
      s.index === index ? { ...s, excluded: true } : s,
    );
    if (this.feedback?.index === index) this.dismissFeedback();
  }

  pause(): void {
    if (this.phase === "paused") return;
    this.dismissFeedback();
    this.deps.audio.cancel();
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
    this.dismissFeedback();
    this.deps.audio.cancel();
    this.deps.coordinator.stop();
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];
    this.started = false;
  }
}
