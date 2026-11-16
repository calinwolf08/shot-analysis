/**
 * In-lesson positioning gate (live redesign — setup-less flow). The loop tells
 * the player when they're positioned to shoot and re-checks between shots.
 * Drives the spoken positioning cues (the player can't see the screen while
 * shooting); WHEN a cue is spoken is decided by ./cue-pacer.
 *
 * Two checks, both side-aware (see ../setup/live-orientation):
 *  - whole body in frame, judged on the side nearest the camera only (the far
 *    side is occluded side-on — requiring it made the gate impossible to pass);
 *  - side-on with the shooting arm nearest the camera.
 */
import type { LandmarkFrame } from "$lib/features/analysis";
import type { SideOrientation } from "../setup/angle-gate";
import { createSustainedCheck } from "../setup/checks";
import {
  detectLiveOrientation,
  isNearSideBodyVisible,
  type FrameOrientation,
} from "../setup/live-orientation";
import { DEFAULT_LIVE_TUNING, type ReadinessTuning } from "../tuning";

/** Which correction to voice, or null when the player is positioned. */
export type ReadinessCue = "full-body" | "side-on" | "turn-around" | null;

/** Spoken/shown text for each cue. */
export const CUE_TEXT: Record<Exclude<ReadinessCue, null>, string> = {
  "full-body": "Step back so your whole body is in frame",
  "side-on": "Turn side-on, shooting arm toward the camera",
  "turn-around": "Turn around, shooting arm toward the camera",
};

/** Spoken once when the player becomes positioned. */
export const READY_TEXT = "Ready. Take your shot.";

/** Pure: resolve full-body first (can't judge angle if cut off). */
export function selectReadinessCue(
  fullBodyOk: boolean,
  detected: FrameOrientation,
  orientationOk: boolean,
): ReadinessCue {
  if (!fullBodyOk) return "full-body";
  if (orientationOk) return null;
  // Side-on but the wrong side faces the camera → turn around; otherwise
  // (facing the camera, angled, or unreadable) → turn side-on.
  if (detected === "side-left" || detected === "side-right")
    return "turn-around";
  return "side-on";
}

export interface ReadinessState {
  readonly positioned: boolean;
  readonly cue: ReadinessCue;
  readonly fullBodyOk: boolean;
  readonly detected: FrameOrientation;
  /** Fraction of recent frames reading as the required side. */
  readonly agreement: number;
}

export interface ReadinessGate {
  update(frame: LandmarkFrame): ReadinessState;
  reset(): void;
}

export function createReadinessGate(opts: {
  requiredOrientation: SideOrientation;
  tuning?: ReadinessTuning;
}): ReadinessGate {
  const t = opts.tuning ?? DEFAULT_LIVE_TUNING.readiness;
  const sustain = createSustainedCheck(t.fullBodyHoldMs);
  let recent: LandmarkFrame[] = [];

  return {
    update(frame) {
      const fullBodyOk = sustain.update(
        // Judge the side actually facing the camera (see isNearSideBodyVisible).
        isNearSideBodyVisible(frame, "auto", t),
        frame.timestamp,
      );
      recent.push(frame);
      if (recent.length > t.orientationWindow) {
        recent = recent.slice(-t.orientationWindow);
      }
      const o = detectLiveOrientation(recent, {
        maxSideSeparation: t.maxSideSeparation,
        required: opts.requiredOrientation,
      });
      const orientationOk =
        recent.length >= 3 && o.requiredAgreement >= t.minOrientationAgreement;
      const cue = selectReadinessCue(fullBodyOk, o.orientation, orientationOk);
      return {
        positioned: cue === null,
        cue,
        fullBodyOk,
        detected: o.orientation,
        agreement: o.requiredAgreement,
      };
    },
    reset() {
      sustain.reset();
      recent = [];
    },
  };
}
