/**
 * Assessment wizard state machine:
 *   idle → picking → analyzing → reviewing → done | aborted
 * Pure transitions over an injected AssessmentService (fake in tests).
 */
import type { ShotRecord } from "$lib/shared/db/repos";
import type {
  AssessmentOutcome,
  AssessmentProgress,
  AssessmentService,
  AssessmentVideoInput,
} from "../services/assessment-service";
import { AssessmentAbortedError } from "../services/assessment-service";

export type AssessmentPhase =
  | "idle"
  | "picking"
  | "analyzing"
  | "reviewing"
  | "done"
  | "aborted";

export class AssessmentStore {
  phase = $state<AssessmentPhase>("idle");
  inputs = $state<AssessmentVideoInput[]>([]);
  progress = $state<AssessmentProgress | null>(null);
  outcome = $state<AssessmentOutcome | null>(null);
  error = $state<string | null>(null);
  /** Distinguishes the coaching empty state from generic failures. */
  errorKind = $state<"no-shots" | "generic" | null>(null);
  /** Shots the user toggled during review (id → excluded). */
  pendingExclusions = $state<Record<string, boolean>>({});

  private controller: AbortController | null = null;

  constructor(
    private readonly service: AssessmentService,
    private readonly opts: { planItemId?: string | null } = {},
  ) {}

  begin(): void {
    if (this.phase !== "idle") return;
    this.phase = "picking";
  }

  addInputs(inputs: AssessmentVideoInput[]): void {
    if (this.phase !== "picking") return;
    this.inputs = [...this.inputs, ...inputs].slice(0, 10); // 1–10 videos
  }

  removeInput(index: number): void {
    if (this.phase !== "picking") return;
    this.inputs = this.inputs.filter((_, i) => i !== index);
  }

  async start(): Promise<void> {
    if (this.phase !== "picking" || this.inputs.length === 0) return;
    this.phase = "analyzing";
    this.error = null;
    this.errorKind = null;
    this.controller = new AbortController();
    try {
      this.outcome = await this.service.runAssessment(this.inputs, {
        signal: this.controller.signal,
        onProgress: (p) => {
          this.progress = p;
        },
        ...(this.opts.planItemId ? { planItemId: this.opts.planItemId } : {}),
      });
      this.phase = "reviewing";
    } catch (err) {
      if (err instanceof AssessmentAbortedError) {
        this.phase = "aborted";
      } else {
        this.error = err instanceof Error ? err.message : String(err);
        this.errorKind =
          err instanceof Error && err.name === "NoShotsDetectedError"
            ? "no-shots"
            : "generic";
        this.phase = "picking"; // retry affordance
      }
    } finally {
      this.controller = null;
    }
  }

  cancel(): void {
    this.controller?.abort();
  }

  toggleExclude(shot: ShotRecord): void {
    if (this.phase !== "reviewing") return;
    const current = this.pendingExclusions[shot.id] ?? shot.excluded;
    this.pendingExclusions = { ...this.pendingExclusions, [shot.id]: !current };
  }

  isExcluded(shot: ShotRecord): boolean {
    return this.pendingExclusions[shot.id] ?? shot.excluded;
  }

  /** Applies exclusions (re-scoring if anything changed) and finishes. */
  async finishReview(): Promise<string | null> {
    if (this.phase !== "reviewing" || !this.outcome) return null;
    const changed = Object.entries(this.pendingExclusions).filter(
      ([id, excluded]) =>
        this.outcome!.shots.find((s) => s.id === id)?.excluded !== excluded,
    );
    try {
      if (changed.length > 0) {
        for (const [id, excluded] of changed) {
          await this.service.setShotExcluded(id, excluded);
        }
        this.outcome = await this.service.rescoreSession(
          this.outcome.sessionId,
        );
      }
      this.phase = "done";
      return this.outcome.sessionId;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      return null;
    }
  }
}
