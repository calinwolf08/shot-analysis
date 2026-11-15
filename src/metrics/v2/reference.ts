/**
 * Reference (pro) skeletons per keyframe — the "you vs. pro" target (Step 10).
 *
 * A shot's pose at a keyframe is normalized into a stance-relative space
 * (origin at the center of the feet, scaled by body height), so skeletons from
 * different clips/players line up. The reference skeleton is the median of that
 * normalized pose across the reference shots. To draw it on a user's frame we
 * de-normalize back through the user's own center-of-feet + scale, so the pro
 * skeleton is aligned to the user's stance and size.
 *
 * @see docs/implementation-plan-metrics-overhaul.md (Step 10)
 */

import type { Frame, KeyframeId, TestLandmark } from "../../testing/types";
import { TOTAL_LANDMARKS } from "../../types";
import { ankleLineY, bodyScaleY, centerOfFeetX, MIN_VISIBILITY } from "./normalize";

export const REFERENCE_VERSION = 1 as const;

/** A landmark in stance-normalized space; null when it wasn't tracked. */
export interface NormLandmark {
  readonly x: number;
  readonly y: number;
}

export interface ReferenceSkeleton {
  /** 33 normalized landmarks (null where no reliable reference exists). */
  readonly landmarks: readonly (NormLandmark | null)[];
}

export interface ReferencePoses {
  readonly version: number;
  readonly generatedFrom: readonly string[];
  readonly byKeyframe: Partial<Record<KeyframeId, ReferenceSkeleton>>;
}

/**
 * Normalizes a frame's landmarks into stance space:
 *   nx = (x − centerOfFeetX) / bodyScale
 *   ny = (y − ankleLineY)   / bodyScale
 * Returns null landmarks where the reference anchors or the landmark itself
 * aren't visible. Returns null entirely when the anchors are missing.
 */
export function normalizeSkeleton(frame: Frame): (NormLandmark | null)[] | null {
  const centerX = centerOfFeetX(frame);
  const ankleY = ankleLineY(frame);
  const scale = bodyScaleY(frame);
  if (centerX === null || ankleY === null || scale === null) return null;
  const out: (NormLandmark | null)[] = [];
  for (let i = 0; i < TOTAL_LANDMARKS; i++) {
    const l = frame.landmarks?.[i];
    if (!l || (l.visibility ?? 0) < MIN_VISIBILITY) {
      out.push(null);
      continue;
    }
    out.push({ x: (l.x - centerX) / scale, y: (l.y - ankleY) / scale });
  }
  return out;
}

function median(nums: number[]): number {
  const v = [...nums].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

/**
 * Builds reference skeletons from normalized poses grouped by keyframe: the
 * per-landmark median across all reference samples for that keyframe.
 *
 * @param samples - normalized skeletons keyed by keyframe (many per keyframe)
 */
export function buildReferenceSkeletons(
  samples: Partial<Record<KeyframeId, (NormLandmark | null)[][]>>,
): Partial<Record<KeyframeId, ReferenceSkeleton>> {
  const out: Partial<Record<KeyframeId, ReferenceSkeleton>> = {};
  for (const [kf, poses] of Object.entries(samples) as [
    KeyframeId,
    (NormLandmark | null)[][],
  ][]) {
    if (!poses || poses.length === 0) continue;
    const landmarks: (NormLandmark | null)[] = [];
    for (let i = 0; i < TOTAL_LANDMARKS; i++) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (const pose of poses) {
        const l = pose[i];
        if (l) {
          xs.push(l.x);
          ys.push(l.y);
        }
      }
      // Require the landmark in at least half the samples to trust the median.
      landmarks.push(
        xs.length >= Math.ceil(poses.length / 2)
          ? { x: median(xs), y: median(ys) }
          : null,
      );
    }
    out[kf] = { landmarks };
  }
  return out;
}

/**
 * De-normalizes a reference skeleton onto a user's frame: places the pro's
 * stance-normalized pose at the user's center-of-feet and body scale, producing
 * landmarks in the user's normalized image coordinates (ready for drawing).
 * Returns null when the user's anchors aren't available in this frame.
 */
export function referenceOnFrame(
  ref: ReferenceSkeleton,
  userFrame: Frame,
): (TestLandmark | null)[] | null {
  const centerX = centerOfFeetX(userFrame);
  const ankleY = ankleLineY(userFrame);
  const scale = bodyScaleY(userFrame);
  if (centerX === null || ankleY === null || scale === null) return null;
  return ref.landmarks.map((l) =>
    l
      ? { x: centerX + l.x * scale, y: ankleY + l.y * scale, z: 0, visibility: 1 }
      : null,
  );
}
