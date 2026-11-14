/**
 * Derives per-phase frame ranges from the detected keyframes.
 *
 * Ranges degrade gracefully: when a bounding keyframe is missing we fall back to
 * the next best one, and a phase whose bounds can't be established is returned
 * as null so its metrics are reported unavailable rather than guessed.
 */

import type { KeyframeId } from "../../../testing/types";

export interface FrameRange {
  readonly start: number;
  readonly end: number;
}

export interface PhaseRanges {
  /** Setup snapshot — a single frame at the shot start. */
  readonly gather: number | null;
  /** Legs dropping: bend start → deepest bend. */
  readonly load: FrameRange | null;
  /** Drive up: deepest bend → set point. */
  readonly rise: FrameRange | null;
  /** Set point snapshot — a single frame. */
  readonly setPoint: number | null;
  /** Set point → arm extension (the release action). */
  readonly release: FrameRange | null;
  /** Release → shot end. */
  readonly followThrough: FrameRange | null;
}

function range(a: number | null, b: number | null): FrameRange | null {
  if (a === null || b === null || b < a) return null;
  return { start: a, end: b };
}

export function derivePhaseRanges(
  keyframes: ReadonlyMap<KeyframeId, number | null>,
  startFrame: number,
  endFrame: number,
): PhaseRanges {
  const kf = (id: KeyframeId): number | null => keyframes.get(id) ?? null;

  const legsBend = kf("legs_start_bending") ?? startFrame;
  const legLow = kf("leg_bend_low_point");
  const ballLow = kf("ball_low_point");
  const setPoint = kf("set_point");
  const armsExtended = kf("arms_fully_extended");
  const release = kf("release");

  // Load ends at the deepest bend (fall back to the ball low point).
  const loadEnd = legLow ?? ballLow;
  // Rise starts at the deepest bend and drives to the set point.
  const riseStart = legLow ?? ballLow;

  return {
    gather: startFrame,
    load: range(legsBend, loadEnd),
    rise: range(riseStart, setPoint),
    setPoint: setPoint,
    // The release action runs from the set point through full arm extension
    // (fall back to the release snap, then the shot end).
    release: range(setPoint, armsExtended ?? release ?? endFrame),
    // Follow-through from the release snap (fall back to arm extension) to end.
    followThrough: range(release ?? armsExtended, endFrame),
  };
}
