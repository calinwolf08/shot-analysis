/**
 * Landmark accessors and angle helpers for structure metrics.
 *
 * Everything returns null when the landmarks aren't visible enough, so callers
 * can propagate an unreliable Measurement instead of a fabricated number.
 */

import type { Frame, TestLandmark } from "../../../testing/types";
import { LANDMARK_INDICES } from "../../../types";
import { calculateAngle } from "../../../utils/geometry";
import { MIN_VISIBILITY } from "../normalize";

export type ShootingHand = "left" | "right";

/** A visible landmark, or null. */
export function pt(frame: Frame, index: number): TestLandmark | null {
  const l = frame.landmarks?.[index];
  if (!l || (l.visibility ?? 0) < MIN_VISIBILITY) return null;
  return l;
}

/** Angle (degrees) at joint `bIdx` between `aIdx` and `cIdx`, or null. */
export function jointAngle(
  frame: Frame,
  aIdx: number,
  bIdx: number,
  cIdx: number,
): number | null {
  const a = pt(frame, aIdx);
  const b = pt(frame, bIdx);
  const c = pt(frame, cIdx);
  if (!a || !b || !c) return null;
  return calculateAngle(a, b, c);
}

/** 2D distance between the two shoulders (a body-relative width unit), or null. */
export function shoulderWidth(frame: Frame): number | null {
  const l = pt(frame, LANDMARK_INDICES.LEFT_SHOULDER);
  const r = pt(frame, LANDMARK_INDICES.RIGHT_SHOULDER);
  if (!l || !r) return null;
  return Math.hypot(l.x - r.x, l.y - r.y);
}

/** 2D distance between the two wrists (guide-hand separation), or null. */
export function wristSeparation(frame: Frame): number | null {
  const l = pt(frame, LANDMARK_INDICES.LEFT_WRIST);
  const r = pt(frame, LANDMARK_INDICES.RIGHT_WRIST);
  if (!l || !r) return null;
  return Math.hypot(l.x - r.x, l.y - r.y);
}

/** The shooting / guide arm landmark indices for a given hand. */
export function armIndices(hand: ShootingHand): {
  shooting: { shoulder: number; elbow: number; wrist: number; index: number };
  guide: { shoulder: number; elbow: number; wrist: number; index: number };
} {
  const right = {
    shoulder: LANDMARK_INDICES.RIGHT_SHOULDER,
    elbow: LANDMARK_INDICES.RIGHT_ELBOW,
    wrist: LANDMARK_INDICES.RIGHT_WRIST,
    index: LANDMARK_INDICES.RIGHT_INDEX,
  };
  const left = {
    shoulder: LANDMARK_INDICES.LEFT_SHOULDER,
    elbow: LANDMARK_INDICES.LEFT_ELBOW,
    wrist: LANDMARK_INDICES.LEFT_WRIST,
    index: LANDMARK_INDICES.LEFT_INDEX,
  };
  return hand === "right"
    ? { shooting: right, guide: left }
    : { shooting: left, guide: right };
}

/**
 * Wrist "cock" angle: the angle at the wrist between the forearm (elbow→wrist)
 * and the hand (wrist→index). ~180° is a straight/neutral wrist; a smaller
 * angle means the wrist is cocked back. Null when the hand landmarks (17-22)
 * aren't tracked — common, so callers must tag reliability from this.
 */
export function wristCockAngle(
  frame: Frame,
  arm: { elbow: number; wrist: number; index: number },
): number | null {
  return jointAngle(frame, arm.elbow, arm.wrist, arm.index);
}

/** Elbow angle: shoulder→elbow→wrist. ~180° at full extension. */
export function elbowAngle(
  frame: Frame,
  arm: { shoulder: number; elbow: number; wrist: number },
): number | null {
  return jointAngle(frame, arm.shoulder, arm.elbow, arm.wrist);
}
