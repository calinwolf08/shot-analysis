/**
 * Angle gate (live redesign — step 5, §3.3).
 *
 * v1 scores one viewing angle: side-on with the shooting arm toward the camera,
 * matching the approved Stephen Curry side-left baseline. A right-handed shooter
 * sets up as `side-left`; a left-handed shooter mirrors to `side-right` (the
 * pose is mirrored so the same targets apply). The capture screen uses this to
 * guide the user into position and block the start until the detected
 * orientation matches.
 *
 * Pure — detection (e.g. the library's `detectOrientation`) feeds the result in.
 */
import type { ShootingHand } from "$lib/shared/db/repos";

export type SideOrientation = "side-left" | "side-right";

export interface AngleGateResult {
  /** True when the detected orientation matches the required side. */
  readonly ok: boolean;
  readonly required: SideOrientation;
  readonly detected: string | null;
  /** Short guidance when not ok; null when ok. */
  readonly reason: string | null;
}

/** The side-on orientation a shooter sets up in, given their shooting hand. */
export function requiredOrientation(hand: ShootingHand): SideOrientation {
  // Right-handed matches Curry's approved side-left shots; left-handed mirrors.
  return hand === "right" ? "side-left" : "side-right";
}

/** Evaluates a detected orientation against the required setup for the hand. */
export function evaluateAngleGate(
  detected: string | null | undefined,
  hand: ShootingHand,
): AngleGateResult {
  const required = requiredOrientation(hand);
  const det = detected ?? null;

  if (!det || det === "unknown") {
    return {
      ok: false,
      required,
      detected: det,
      reason: "Stand side-on to the camera, shooting arm toward it",
    };
  }
  if (det === required) {
    return { ok: true, required, detected: det, reason: null };
  }
  const isSideOn = det === "side-left" || det === "side-right";
  return {
    ok: false,
    required,
    detected: det,
    reason: isSideOn
      ? "Turn around so your shooting arm faces the camera"
      : "Stand side-on to the camera, shooting arm toward it",
  };
}
