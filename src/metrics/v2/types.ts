/**
 * Versioned metric schema for the Sequencing / Structure scoring overhaul.
 *
 * These types describe the raw MEASUREMENTS extracted from a shot (not scores).
 * The same extraction runs on NBA reference clips and on user shots, so a shot's
 * metrics can be scored against thresholds derived from the reference set.
 *
 * Structure metrics land in Step 3; this file currently defines the shared
 * envelope, reliability tagging, and the fully-specified sequencing block.
 *
 * @see docs/implementation-plan-metrics-overhaul.md
 */

import { z } from "zod";
import type { KeyframeId } from "../../testing/types";

export const METRICS_SCHEMA_VERSION = 1 as const;

// ============================================================================
// Measurement envelope
// ============================================================================

/**
 * A single measured value plus the provenance needed to score and visualize it.
 * `reliable === false` means the value could not be trusted (wrong camera angle,
 * occluded landmarks, missing keyframe) and MUST be excluded from scoring rather
 * than treated as a real reading.
 */
export interface Measurement {
  /** The measured value in its metric's unit (see the metric's docs). */
  readonly value: number;
  /** Frame(s) the value was measured at, for jump-to-frame / screenshots. */
  readonly frames: readonly number[];
  /** Whether the value is trustworthy enough to score. */
  readonly reliable: boolean;
  /** Optional human-readable reason when unreliable. */
  readonly note?: string;
}

export const measurementSchema = z.object({
  value: z.number(),
  frames: z.array(z.number().int().nonnegative()),
  reliable: z.boolean(),
  note: z.string().optional(),
});

/** Helper to build a reliable measurement. */
export function measure(value: number, frames: number[]): Measurement {
  return { value, frames, reliable: true };
}

/** Helper to build an unreliable / unavailable measurement. */
export function unavailable(note: string, frames: number[] = []): Measurement {
  return { value: NaN, frames, reliable: false, note };
}

// ============================================================================
// Sequencing (Efficiency) — event order + normalized timing
// ============================================================================

/**
 * The eight ordered shot events, each backed by a keyframe. This IS the
 * canonical order; the gaps below measure whether a shot honors it.
 */
export type SequenceEventId =
  | "ball_low"
  | "ball_rise"
  | "leg_low"
  | "legs_rise"
  | "set_point"
  | "legs_extend"
  | "release"
  | "arm_extension";

/** Maps each sequence event to the keyframe that locates it. */
export const SEQUENCE_EVENT_KEYFRAMES: ReadonlyArray<{
  readonly id: SequenceEventId;
  readonly keyframe: KeyframeId;
  readonly label: string;
}> = [
  { id: "ball_low", keyframe: "ball_low_point", label: "Ball low point" },
  { id: "ball_rise", keyframe: "ball_starts_upward", label: "Ball starts rising" },
  { id: "leg_low", keyframe: "leg_bend_low_point", label: "Leg low point" },
  { id: "legs_rise", keyframe: "legs_start_extending", label: "Legs start rising" },
  { id: "set_point", keyframe: "set_point", label: "Set point reached" },
  { id: "legs_extend", keyframe: "legs_fully_extended", label: "Legs extend" },
  { id: "release", keyframe: "release", label: "Release" },
  { id: "arm_extension", keyframe: "arms_fully_extended", label: "Arm extension" },
] as const;

/** A located event: its frame and its normalized time (0..1 across the shot). */
export interface SequenceEvent {
  readonly id: SequenceEventId;
  readonly label: string;
  /** Frame index, or null when the keyframe wasn't detected. */
  readonly frame: number | null;
  /** Normalized time (fraction of shot duration), or null when undetected. */
  readonly t: number | null;
}

/**
 * A signed, normalized gap between two events (as a fraction of shot duration).
 * Positive = `to` happens after `from` (correct order). Negative = order
 * violated. Magnitude = how much time elapsed between them.
 */
export interface SequenceGap {
  readonly from: SequenceEventId;
  readonly to: SequenceEventId;
  /** Signed normalized gap (t_to − t_from), or a reliability marker. */
  readonly gap: Measurement;
}

export interface SequencingMetrics {
  readonly events: readonly SequenceEvent[];
  readonly gaps: readonly SequenceGap[];
  /** Fraction of the eight events that were actually detected (0..1). */
  readonly coverage: number;
}

// ============================================================================
// Structure (placeholder — populated in Step 3)
// ============================================================================

/** Per-phase structure metrics keyed by metric id. Filled in Step 3. */
export type StructureMetrics = Partial<
  Record<"gather" | "load" | "rise" | "setPoint" | "release" | "followThrough", Record<string, Measurement>>
>;

// ============================================================================
// Top-level record
// ============================================================================

export interface ShotMetricsV2 {
  readonly schemaVersion: typeof METRICS_SCHEMA_VERSION;
  readonly shot: {
    readonly startFrame: number;
    readonly endFrame: number;
    readonly fps: number;
    readonly cameraOrientation: string;
  };
  readonly reliability: {
    readonly poseConfidence: number;
    /** True for side-ish views where posture/depth metrics are meaningful. */
    readonly sideView: boolean;
  };
  readonly sequencing: SequencingMetrics;
  readonly structure?: StructureMetrics;
}
