/**
 * In-lesson positioning gate (live redesign — setup-less flow). Replaces the
 * separate setup screen: the player starts the lesson and the loop itself tells
 * them when they're positioned to shoot, re-checking between shots. Drives the
 * spoken positioning cues (the player can't see the screen while shooting).
 *
 * Only the position-relevant checks live here — full body in frame + the
 * shooting-arm-toward-camera orientation. Lighting/stability were one-time setup
 * concerns and are dropped from the per-shot gate.
 */
import { detectOrientation } from "basketball-shot-analysis";
import type { LandmarkFrame } from "$lib/features/analysis";
import { landmarkFramesToPoseData } from "$lib/features/analysis/replay/replay-pipeline";
import type { SideOrientation } from "../setup/angle-gate";
import {
  CHECK_DEFAULTS,
  createSustainedCheck,
  isFullBodyVisible,
} from "../setup/checks";

/** Which correction to voice, or null when the player is positioned. */
export type ReadinessCue = "full-body" | "orientation" | null;

/** Spoken/shown text for each cue. */
export const CUE_TEXT: Record<"full-body" | "orientation", string> = {
  "full-body": "Step back so your whole body is in frame",
  orientation: "Turn side-on — shooting arm toward the camera",
};

/** Pure: resolve full-body before orientation (can't judge angle if cut off). */
export function selectReadinessCue(
  fullBodyOk: boolean,
  orientationOk: boolean,
): ReadinessCue {
  if (!fullBodyOk) return "full-body";
  if (!orientationOk) return "orientation";
  return null;
}

export interface ReadinessState {
  readonly positioned: boolean;
  readonly cue: ReadinessCue;
}

export interface ReadinessGate {
  update(frame: LandmarkFrame): ReadinessState;
  reset(): void;
}

export function createReadinessGate(opts: {
  requiredOrientation: SideOrientation;
  fps: number;
  fullBodySustainMs?: number;
}): ReadinessGate {
  const sustain = createSustainedCheck(
    opts.fullBodySustainMs ?? CHECK_DEFAULTS.fullBodySustainMs,
  );
  let recent: LandmarkFrame[] = [];
  let orientationOk = false;

  return {
    update(frame) {
      const fullBodyOk = sustain.update(
        isFullBodyVisible(frame),
        frame.timestamp,
      );
      recent.push(frame);
      if (recent.length > CHECK_DEFAULTS.sideViewWindow) {
        recent = recent.slice(-CHECK_DEFAULTS.sideViewWindow);
      }
      if (recent.length >= 3) {
        const detected = detectOrientation(
          landmarkFramesToPoseData(recent, opts.fps),
        );
        orientationOk = detected === opts.requiredOrientation;
      }
      const cue = selectReadinessCue(fullBodyOk, orientationOk);
      return { positioned: cue === null, cue };
    },
    reset() {
      sustain.reset();
      recent = [];
      orientationOk = false;
    },
  };
}
