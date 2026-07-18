/**
 * Normalization primitives shared by every v2 metric.
 *
 * The goal is that a metric reads the same regardless of camera zoom, where the
 * player stands in frame, or which way they face:
 *  - distances are divided by a body-scale estimate (nose→ankle span),
 *  - times are expressed as a fraction of the shot duration,
 *  - horizontal posture is measured as a signed offset from the center of the
 *    feet, with the sign flipped so "toward the hoop" is always positive.
 *
 * @see docs/implementation-plan-metrics-overhaul.md (Step 0)
 */

import type { Frame, TestLandmark } from "../../testing/types";
import { LANDMARK_INDICES } from "../../types";

/** Minimum landmark visibility to treat a coordinate as usable. */
export const MIN_VISIBILITY = 0.3;

function lm(frame: Frame, index: number): TestLandmark | null {
  const l = frame.landmarks?.[index];
  if (!l) return null;
  if ((l.visibility ?? 0) < MIN_VISIBILITY) return null;
  return l;
}

/** Average of two landmarks' Y, using whichever are visible (null if neither). */
function avgY(a: TestLandmark | null, b: TestLandmark | null): number | null {
  if (a && b) return (a.y + b.y) / 2;
  return a?.y ?? b?.y ?? null;
}

function avgX(a: TestLandmark | null, b: TestLandmark | null): number | null {
  if (a && b) return (a.x + b.x) / 2;
  return a?.x ?? b?.x ?? null;
}

/** Normalized time of `frame` within [startFrame, endFrame] (0..1). */
export function normTime(
  frame: number,
  startFrame: number,
  endFrame: number,
): number {
  const span = endFrame - startFrame;
  if (span <= 0) return 0;
  return (frame - startFrame) / span;
}

/**
 * Body-scale estimate for `frame`: the vertical span from the nose to the ankle
 * midpoint. All normalized distances divide by this so camera zoom and player
 * height cancel out. Returns null when the needed landmarks aren't visible.
 */
export function bodyScaleY(frame: Frame): number | null {
  const nose = lm(frame, LANDMARK_INDICES.NOSE);
  const ankleY = avgY(
    lm(frame, LANDMARK_INDICES.LEFT_ANKLE),
    lm(frame, LANDMARK_INDICES.RIGHT_ANKLE),
  );
  if (!nose || ankleY === null) return null;
  const span = Math.abs(ankleY - nose.y);
  return span > 1e-3 ? span : null;
}

/**
 * Horizontal center of the feet (ankle midpoint X) — our stand-in for the body's
 * center line. Posture offsets are measured relative to this. Null if neither
 * ankle is visible.
 */
export function centerOfFeetX(frame: Frame): number | null {
  return avgX(
    lm(frame, LANDMARK_INDICES.LEFT_ANKLE),
    lm(frame, LANDMARK_INDICES.RIGHT_ANKLE),
  );
}

/** Vertical ankle line (ankle midpoint Y) — the ground reference. Null if neither ankle visible. */
export function ankleLineY(frame: Frame): number | null {
  return avgY(
    lm(frame, LANDMARK_INDICES.LEFT_ANKLE),
    lm(frame, LANDMARK_INDICES.RIGHT_ANKLE),
  );
}

/**
 * Whether posture / depth metrics are meaningful for this camera orientation.
 * Those metrics rely on a side-on horizontal axis; front/behind views collapse
 * it, so we tag them unreliable rather than guessing.
 */
export function isSideView(orientation: string): boolean {
  return orientation === "side-left" || orientation === "side-right";
}

/**
 * Sign that makes "toward the hoop" positive for horizontal offsets. For a
 * side-right view the shooter faces screen-left (−X is forward), and vice versa.
 * Returns 0 for non-side views (offsets aren't meaningful there).
 */
export function orientationSign(orientation: string): number {
  if (orientation === "side-right") return -1;
  if (orientation === "side-left") return 1;
  return 0;
}

/**
 * Signed, body-scaled horizontal offset of a joint from the center of the feet,
 * oriented so positive = toward the hoop. Null when the joint, the feet center,
 * or the body scale is unavailable.
 */
export function forwardOffset(
  frame: Frame,
  jointIndex: number,
  orientation: string,
): number | null {
  const joint = lm(frame, jointIndex);
  const centerX = centerOfFeetX(frame);
  const scale = bodyScaleY(frame);
  const sign = orientationSign(orientation);
  if (!joint || centerX === null || scale === null || sign === 0) return null;
  return (sign * (joint.x - centerX)) / scale;
}

/**
 * Body-scaled height of a joint above the ankle line (positive = higher up the
 * frame). Null when the joint, ankle line, or scale is unavailable.
 */
export function heightAboveFeet(
  frame: Frame,
  jointIndex: number,
): number | null {
  const joint = lm(frame, jointIndex);
  const ankleY = avgY(
    lm(frame, LANDMARK_INDICES.LEFT_ANKLE),
    lm(frame, LANDMARK_INDICES.RIGHT_ANKLE),
  );
  const scale = bodyScaleY(frame);
  if (!joint || ankleY === null || scale === null) return null;
  return (ankleY - joint.y) / scale;
}

export const LANDMARKS = LANDMARK_INDICES;
