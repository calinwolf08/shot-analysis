/**
 * Live practice session store — binds the LiveRepCoordinator to scoring,
 * persistence, and audio feedback. Every rep is persisted (shot + rep +
 * score rows) regardless of what the feedback card surfaces.
 */
import type {
  BenchmarkProfile,
  BenchmarkService,
  MetricName,
} from "$lib/features/benchmarks";
import type {
  CueSelection,
  RepScore,
  ScoringService,
} from "$lib/features/scoring";
import { landmarkFramesToPoseData } from "$lib/features/analysis/replay/replay-pipeline";
import type { ApiClient } from "$lib/shared/api/client";
import type { AudioFeedbackService } from "$lib/shared/audio";
import type { AppRepos } from "$lib/shared/config/services";
import type { ShotRecord } from "$lib/shared/db/repos";
import type { DatabaseAdapter } from "$lib/shared/db";
import { flushDb } from "$lib/shared/db";
import type {
  CoordinatorEvents,
  LiveRepCoordinator,
} from "../coordinator/coordinator";

/** Server response from POST /api/analysis/shot. */
interface ScoredShotResponse {
  shots: { shot: ShotRecord; repScore: RepScore; cues: CueSelection }[];
}

export interface RepEntry {
  repIndex: number; // 1-based
  shotId: string;
  score: number | null;
  /** vs the running average before this rep; null on the first rep. */
  delta: number | null;
  cues: CueSelection;
  excluded: boolean;
}

export interface RepFeedback {
  repIndex: number;
  score: number | null;
  delta: number | null;
  cues: CueSelection;
}

export type LoopPhase =
  | "idle"
  | "ready"
  | "active"
  | "analyzing"
  | "feedback"
  | "paused"
  | "ended";

export interface LiveSessionStoreDeps {
  repos: AppRepos;
  scoring: ScoringService;
  benchmarks: BenchmarkService;
  /** Transport for the per-rep server analysis (POST /api/analysis/shot). */
  api: ApiClient;
  /** Frame rate of the rep windows, used to reconstruct PoseData. */
  fps: number;
  db: DatabaseAdapter;
  coordinator: LiveRepCoordinator;
  audio: AudioFeedbackService;
  focusMetric?: MetricName | null;
  planItemId?: string | null;
  /** Feedback card auto-dismiss (wall-clock ms). */
  feedbackMs?: number;
}

export class LiveSessionStore {
  phase = $state<LoopPhase>("idle");
  sessionId = $state<string | null>(null);
  reps = $state<RepEntry[]>([]);
  feedback = $state<RepFeedback | null>(null);
  noShotFlash = $state(false);
  muted = $state(false);
  error = $state<string | null>(null);

  private benchmark: BenchmarkProfile | null = null;
  private playerId: string | null = null;
  private unsubscribes: (() => void)[] = [];
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly feedbackMs: number;

  constructor(private readonly deps: LiveSessionStoreDeps) {
    this.feedbackMs = deps.feedbackMs ?? 4000;
    this.muted = deps.audio.isMuted();
  }

  /** Included (non-excluded) rep scores' running average, 0–100. */
  get average(): number | null {
    const scores = this.reps
      .filter((r) => !r.excluded && r.score !== null)
      .map((r) => r.score!);
    if (scores.length === 0) return null;
    return scores.reduce((s, v) => s + v, 0) / scores.length;
  }

  get repCount(): number {
    return this.reps.filter((r) => !r.excluded).length;
  }

  async start(): Promise<void> {
    if (this.sessionId) return;
    const { repos, coordinator } = this.deps;
    const player = await repos.player.getFirst();
    if (!player) throw new Error("No player onboarded");
    this.playerId = player.id;
    const session = await repos.session.create({
      playerId: player.id,
      type: "live_practice",
      ...(this.deps.planItemId ? { planItemId: this.deps.planItemId } : {}),
      ...(this.deps.focusMetric ? { focusMetric: this.deps.focusMetric } : {}),
    });
    this.sessionId = session.id;
    this.benchmark = await this.deps.benchmarks.getActive();

    this.unsubscribes = [
      coordinator.on("stateChanged", ({ to }) => {
        if (this.phase === "paused" || this.phase === "ended") return;
        this.phase = to.toLowerCase() as LoopPhase;
      }),
      coordinator.on("repResult", (event) => {
        void this.handleRepResult(event);
      }),
      coordinator.on("noShot", () => this.flashNoShot()),
    ];
    coordinator.start();
    this.phase = "ready";
  }

  private async handleRepResult(
    event: CoordinatorEvents["repResult"],
  ): Promise<void> {
    const { repos, api } = this.deps;
    if (!this.sessionId || !this.playerId) return;
    try {
      const previousAverage = this.average;
      // Client detected the rep boundary; the server runs the authoritative
      // full analysis + scoring on the window's pose frames (identical to the
      // upload path — see docs/server-migration-plan Step 7.2).
      const poseData = landmarkFramesToPoseData(
        event.window.frames,
        this.deps.fps,
      );
      const { shots } = await api.send<ScoredShotResponse>(
        "/api/analysis/shot",
        { sessionId: this.sessionId, playerId: this.playerId, poseData },
      );
      if (shots.length === 0) {
        // The server saw no shot in the window; surface it like a miss.
        this.flashNoShot();
        return;
      }
      const scored = shots[0]!;
      const record = scored.shot;
      const score = scored.repScore.formScore;
      await repos.rep.create({
        sessionId: this.sessionId,
        repIndex: this.reps.length,
        shotId: record.id,
        ...(score !== null ? { repScore: score } : {}),
        ...(scored.cues.primary
          ? { primaryCue: scored.cues.primary.text }
          : {}),
        feedback: scored.cues,
      });

      const entry: RepEntry = {
        repIndex: this.reps.length + 1,
        shotId: record.id,
        score,
        delta:
          score !== null && previousAverage !== null
            ? score - previousAverage
            : null,
        cues: scored.cues,
        excluded: false,
      };
      this.reps = [...this.reps, entry];
      this.feedback = {
        repIndex: entry.repIndex,
        score,
        delta: entry.delta,
        cues: entry.cues,
      };
      this.speakFeedback(entry);
      this.dismissTimer = setTimeout(
        () => this.dismissFeedback(),
        this.feedbackMs,
      );
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      this.dismissFeedback();
    }
  }

  private speakFeedback(entry: RepEntry): void {
    if (entry.score === null) return;
    const cue = entry.cues.primary?.text;
    this.deps.audio.speak(`${Math.round(entry.score)}${cue ? `. ${cue}` : ""}`);
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

  /** "Not a shot?" — excludes the rep's shot and re-averages. */
  async excludeRep(repIndex: number): Promise<void> {
    const entry = this.reps.find((r) => r.repIndex === repIndex);
    if (!entry || entry.excluded) return;
    await this.deps.repos.shot.setExcluded(entry.shotId, true);
    this.reps = this.reps.map((r) =>
      r.repIndex === repIndex ? { ...r, excluded: true } : r,
    );
    if (this.feedback?.repIndex === repIndex) this.dismissFeedback();
  }

  pause(): void {
    if (this.phase === "paused" || this.phase === "ended") return;
    this.dismissFeedback();
    this.deps.coordinator.stop();
    this.phase = "paused";
  }

  resume(): void {
    if (this.phase !== "paused") return;
    this.deps.coordinator.start();
    this.phase = "idle";
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.deps.audio.setMuted(this.muted);
  }

  /** Ends the session; returns the sessionId for the summary route. */
  async end(): Promise<string | null> {
    if (!this.sessionId || this.phase === "ended") return this.sessionId;
    this.dismissFeedback();
    this.phase = "ended";
    this.deps.coordinator.stop();
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];

    const { repos, scoring, db } = this.deps;
    await repos.session.complete(this.sessionId);
    if (this.repCount > 0 && this.benchmark) {
      await scoring.scoreAndPersistSession(this.sessionId, this.benchmark);
    }
    await flushDb(db);
    return this.sessionId;
  }
}
