/**
 * Type definitions for shot detection and phase identification.
 *
 * This module defines types for detecting basketball shots in video frames
 * and identifying the key phases of each shot.
 *
 * @see Feature 4.0 - Shot Detection & Phase Identification
 */

/**
 * Phases of a basketball shot.
 *
 * The shot is divided into 6 sequential phases:
 * - gather: Ball is caught or pulled in, player prepares to shoot
 * - load: Player loads legs and brings ball to shooting pocket
 * - rise: Player begins upward motion, ball rises with body
 * - setPoint: Ball reaches highest point before release, elbow at ~90 degrees
 * - release: Ball leaves hand, wrist snaps forward
 * - followThrough: Post-release motion, arm fully extended
 *
 * Note: Some phases may be missing in partial shots (e.g., video starts mid-shot).
 */
export enum ShotPhase {
  /** Ball is caught or pulled in, player prepares to shoot */
  Gather = "gather",
  /** Player loads legs and brings ball to shooting pocket */
  Load = "load",
  /** Player begins upward motion, ball rises with body */
  Rise = "rise",
  /** Ball reaches highest point before release */
  SetPoint = "setPoint",
  /** Ball leaves hand, wrist snaps forward */
  Release = "release",
  /** Post-release motion, arm fully extended */
  FollowThrough = "followThrough",
}

/**
 * All valid shot phase values.
 * Useful for iteration and validation.
 */
export const SHOT_PHASES = Object.values(ShotPhase) as readonly ShotPhase[];

/**
 * Number of shot phases.
 */
export const TOTAL_SHOT_PHASES = 6;

/**
 * Frame range for a shot phase.
 * Represents the start and end frame indices for a detected phase.
 */
export interface PhaseRange {
  /** Starting frame index (inclusive, 0-based) */
  readonly startFrame: number;
  /** Ending frame index (inclusive, 0-based) */
  readonly endFrame: number;
}

/**
 * Boundary between two adjacent phases.
 * Captures the transition point and confidence level.
 */
export interface ShotBoundary {
  /** Frame index where the phase transition occurs */
  readonly frameIndex: number;
  /** The phase that ends at this boundary */
  readonly fromPhase: ShotPhase;
  /** The phase that begins at this boundary */
  readonly toPhase: ShotPhase;
  /** Confidence score for this boundary detection (0-1) */
  readonly confidence: number;
}

/**
 * Collection of phase ranges for a shot.
 * Phases are optional because partial shots may skip phases.
 */
export interface ShotPhases {
  /** Gather phase frame range */
  readonly [ShotPhase.Gather]?: PhaseRange;
  /** Load phase frame range */
  readonly [ShotPhase.Load]?: PhaseRange;
  /** Rise phase frame range */
  readonly [ShotPhase.Rise]?: PhaseRange;
  /** Set point phase frame range */
  readonly [ShotPhase.SetPoint]?: PhaseRange;
  /** Release phase frame range */
  readonly [ShotPhase.Release]?: PhaseRange;
  /** Follow through phase frame range */
  readonly [ShotPhase.FollowThrough]?: PhaseRange;
}

/**
 * A detected basketball shot with its frame range and phases.
 */
export interface Shot {
  /** Zero-based index of this shot within the video */
  readonly shotIndex: number;
  /** Frame range spanning the entire shot */
  readonly frameRange: {
    /** Starting frame index (inclusive, 0-based) */
    readonly start: number;
    /** Ending frame index (inclusive, 0-based) */
    readonly end: number;
  };
  /** Phase ranges for each detected phase */
  readonly phases: ShotPhases;
  /** Boundaries between phases within this shot */
  readonly boundaries?: readonly ShotBoundary[];
  /** Overall confidence score for this shot detection (0-1) */
  readonly confidence?: number;
}

/**
 * Associates a frame with its detected phase label.
 * Used for frame-by-frame phase classification.
 */
export interface FrameLabel {
  /** Zero-based frame index */
  readonly frameIndex: number;
  /** The shot phase detected in this frame, or null if no shot is occurring */
  readonly phase: ShotPhase | null;
  /** Index of the shot this frame belongs to, or null if no shot */
  readonly shotIndex: number | null;
  /** Confidence score for the phase classification (0-1) */
  readonly confidence: number;
}

/**
 * Result of shot detection on a video sequence.
 */
export interface ShotDetectionResult {
  /** All detected shots in the video */
  readonly shots: readonly Shot[];
  /** Frame-by-frame phase labels */
  readonly frameLabels: readonly FrameLabel[];
  /** Total number of frames processed */
  readonly totalFrames: number;
}

/**
 * Creates an empty PhaseRange.
 * Useful for initialization or representing undetected phases.
 */
export function createEmptyPhaseRange(): PhaseRange {
  return {
    startFrame: 0,
    endFrame: 0,
  };
}

/**
 * Creates an empty Shot with default values.
 * Useful for initialization.
 *
 * @param shotIndex - The index of the shot
 */
export function createEmptyShot(shotIndex: number = 0): Shot {
  return {
    shotIndex,
    frameRange: { start: 0, end: 0 },
    phases: {},
  };
}

/**
 * Creates a FrameLabel indicating no shot is occurring.
 *
 * @param frameIndex - The frame index
 */
export function createNoShotFrameLabel(frameIndex: number): FrameLabel {
  return {
    frameIndex,
    phase: null,
    shotIndex: null,
    confidence: 1.0,
  };
}

/**
 * Checks if a phase is present in a shot's phases.
 *
 * @param phases - The shot phases object
 * @param phase - The phase to check
 */
export function hasPhase(phases: ShotPhases, phase: ShotPhase): boolean {
  return phases[phase] !== undefined;
}

/**
 * Gets the duration of a phase in frames.
 * Returns 0 if the phase is not present.
 *
 * @param phases - The shot phases object
 * @param phase - The phase to get duration for
 */
export function getPhaseDuration(phases: ShotPhases, phase: ShotPhase): number {
  const range = phases[phase];
  if (range === undefined) {
    return 0;
  }
  return range.endFrame - range.startFrame + 1;
}

/**
 * Gets the total duration of a shot in frames.
 *
 * @param shot - The shot to get duration for
 */
export function getShotDuration(shot: Shot): number {
  return shot.frameRange.end - shot.frameRange.start + 1;
}
