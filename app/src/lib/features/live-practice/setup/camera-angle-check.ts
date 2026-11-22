/**
 * Soft check that the phone is roughly side-on to the player (live practice;
 * docs/pro-targets-plan.md Phase 5). Users aren't corrected for the camera
 * angle — at 10–15° off it's below tracking noise — but beyond ~20° front-to-
 * back measurements shrink noticeably, so the screen shows a hint.
 *
 * Uses the same body-width estimate as the pro tools (population
 * proportions) over a rolling window of recent frames.
 */
import { estimateCameraAngle } from "basketball-shot-analysis";
import type { LandmarkFrame } from "$lib/features/analysis";

/** Degrees off side-on above which the hint shows. */
export const CAMERA_ANGLE_WARN = 20;

export interface CameraAngleMonitor {
  /** Adds a frame; returns the current estimate (null until enough frames). */
  push(frame: LandmarkFrame, aspect: number): number | null;
  reset(): void;
}

export function createCameraAngleMonitor(
  opts: { window?: number; minFrames?: number; every?: number } = {},
): CameraAngleMonitor {
  const size = opts.window ?? 45;
  const minFrames = opts.minFrames ?? 15;
  const every = opts.every ?? 10;
  let recent: LandmarkFrame[] = [];
  let count = 0;
  let last: number | null = null;
  return {
    push(frame, aspect) {
      if (frame.landmarks) recent.push(frame);
      if (recent.length > size) recent = recent.slice(-size);
      count++;
      if (recent.length >= minFrames && count % every === 0 && aspect > 0) {
        const e = estimateCameraAngle(
          recent.map((f) => ({
            frameIndex: f.frameIndex,
            timestamp: f.timestamp,
            landmarks: f.landmarks!.map((l) => ({
              x: l.x,
              y: l.y,
              visibility: l.visibility,
            })),
          })),
          { aspect },
        );
        last = e ? e.angle : null;
      }
      return last;
    },
    reset() {
      recent = [];
      count = 0;
      last = null;
    },
  };
}
