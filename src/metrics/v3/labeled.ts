/**
 * Pairs v3 events with the human keyframe labels in test-data, so tools (the
 * Curry viewer, the agreement test, the eval script) compare them the same way.
 */
import type { EventId } from "./events";

/** v3 event ↔ human label key. */
export const LABEL_FOR_EVENT: ReadonlyArray<readonly [EventId, string]> = [
  ["hipDropStart", "legs_start_bending"],
  ["ballLowest", "ball_low_point"],
  ["ballRiseStart", "ball_starts_upward"],
  ["hipLowest", "leg_bend_low_point"],
  ["kneesStartStraightening", "legs_start_extending"],
  ["setPoint", "set_point"],
  ["kneesStraight", "legs_fully_extended"],
  ["armExtended", "arms_fully_extended"],
];

/** Frames of context taken around a labeled shot window for event search. */
export const EVENT_PAD_BEFORE = 15;
export const EVENT_PAD_AFTER = 10;

/**
 * Start-of-movement labels placed ON the shot's first frame are clipped by the
 * labeled window (movement visibly began earlier), so they aren't comparable.
 */
export function isClippedStartLabel(
  key: string,
  label: number,
  startFrame: number,
): boolean {
  return (
    (key === "legs_start_bending" || key === "ball_low_point") &&
    label === startFrame
  );
}

/**
 * A labelled shot's key frames as v3 event frames (source frame indexes), to
 * measure the shot from the labels instead of detection. Start-of-movement
 * labels clipped by the window (see `isClippedStartLabel`) are left out, so
 * those events are still detected.
 */
export function labeledEventFrames(
  shot: { startFrame: number } & Record<string, unknown>,
): Partial<Record<EventId, number>> {
  const out: Partial<Record<EventId, number>> = {};
  const keys = (shot.keyframes as Record<string, unknown> | undefined) ?? shot;
  for (const [event, key] of LABEL_FOR_EVENT) {
    const v = keys[key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (isClippedStartLabel(key, v, shot.startFrame)) continue;
    out[event] = v;
  }
  return out;
}
