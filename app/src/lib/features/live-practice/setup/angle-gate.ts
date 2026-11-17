/**
 * Angle gate (live redesign — step 5, §3.3).
 *
 * v1 scores one viewing angle: side-on with the SHOOTING ARM nearest the
 * camera (its landmarks are then the clearest). Orientation names say which of
 * the player's sides is nearest: "side-right" = right side nearest. So a
 * right-handed shooter sets up as `side-right`, a left-handed one `side-left`.
 *
 * Note: the Stephen Curry baseline (right-handed, labeled `side-left`) was
 * filmed from his GUIDE-hand side. Side-on 2D metrics are mirror images either
 * way (horizontal offsets are signed "toward the hoop"), so his targets still
 * apply; only his shooting-arm landmarks are a little noisier.
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
  // Shooting arm nearest the camera: right hand → right side nearest.
  return hand === "right" ? "side-right" : "side-left";
}

/**
 * Evaluates a detected orientation against the required setup for the hand.
 *
 * NOTE: the in-loop gate now uses ../loop/readiness (side-aware detector);
 * this general evaluator, which also words front/behind views, is kept for
 * when more orientations are accepted (see pipeline/core#allowedOrientations).
 */
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
