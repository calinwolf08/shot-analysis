/**
 * Player-presence reducer for the live loop's "in frame" indicator.
 * Consumes the live LandmarkFrame stream and answers, on a wall clock:
 * is the player fully in frame, partially tracked, or gone? Wall time
 * (injectable for tests) is what decays the state when frames stop
 * arriving entirely — e.g. a stalled camera.
 */
import type { LandmarkFrame } from "$lib/features/analysis";
import { isFullBodyVisible } from "../setup/checks";

export type PresenceState = "none" | "partial" | "full";

export interface PresenceTrackerOptions {
  /** A posed frame within this window (ms) counts as "tracked". */
  staleMs?: number;
  /** A full-body frame within this window (ms) counts as "fully in frame". */
  fullHoldMs?: number;
}

export interface PresenceTracker {
  /** Feed a live frame; returns the state as of now. */
  update(frame: LandmarkFrame): PresenceState;
  /** Re-evaluate without a new frame (decay when the stream stalls). */
  evaluate(): PresenceState;
}

export function createPresenceTracker(
  opts: PresenceTrackerOptions = {},
  now: () => number = () => performance.now(),
): PresenceTracker {
  const staleMs = opts.staleMs ?? 700;
  const fullHoldMs = opts.fullHoldMs ?? 600;
  let lastPoseAt = Number.NEGATIVE_INFINITY;
  let lastFullAt = Number.NEGATIVE_INFINITY;

  function evaluate(): PresenceState {
    const t = now();
    if (t - lastFullAt <= fullHoldMs) return "full";
    if (t - lastPoseAt <= staleMs) return "partial";
    return "none";
  }

  return {
    update(frame) {
      if (frame.landmarks !== null) {
        const t = now();
        lastPoseAt = t;
        if (isFullBodyVisible(frame)) lastFullAt = t;
      }
      return evaluate();
    },
    evaluate,
  };
}
