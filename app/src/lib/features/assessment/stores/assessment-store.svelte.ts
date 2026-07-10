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

/**
 * Converts technical error messages to user-friendly text.
 * Technical errors (WASM, pose landmarker, etc.) are logged but shown
 * to users as generic messages.
 */
function sanitizeErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  // Technical errors from MediaPipe / WASM initialization
  if (
    message.includes("pose landmarker") ||
    message.includes("WASM") ||
    message.includes("self.import") ||
    message.includes("FilesetResolver") ||
    message.includes("ModuleFactory")
  ) {
    console.error("Analysis initialization error:", message);
    return "Unable to start video analysis. Please refresh and try again.";
  }

  // Network/fetch errors
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "Network error. Please check your connection and try again.";
  }

  // Generic fallback - don't expose raw technical messages
  if (
    message.includes("Error:") ||
    message.includes("failed") ||
    message.includes("undefined") ||
    message.includes("null")
  ) {
    console.error("Analysis error:", message);
    return "Something went wrong. Please try again.";
  }

  return message;
}

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
        this.errorKind =
          err instanceof Error && err.name === "NoShotsDetectedError"
            ? "no-shots"
            : "generic";
        this.error =
          this.errorKind === "no-shots"
            ? null // no-shots has its own UI treatment
            : sanitizeErrorMessage(err);
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
      this.error = sanitizeErrorMessage(err);
      return null;
    }
  }
}
