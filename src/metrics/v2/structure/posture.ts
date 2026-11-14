/**
 * Shared posture core — the "posture, same as in Load" block reused by every
 * phase. For head / shoulders / hips / knees / ankles it measures the signed,
 * body-scaled horizontal offset from the center of the feet (positive = toward
 * the hoop) at the phase START, the phase END, and the DELTA between them
 * (e.g. "as the player drops, how far forward do the hips travel").
 *
 * Offsets are only meaningful in side views; in other views the orientation
 * sign is 0, the offsets come back null, and every posture metric is tagged
 * unavailable rather than guessed.
 */

import type { Frame } from "../../../testing/types";
import { LANDMARK_INDICES } from "../../../types";
import {
  bodyScaleY,
  centerOfFeetX,
  orientationSign,
} from "../normalize";
import { measure, unavailable, type Measurement } from "../types";
import { pt } from "./geometry";
import type { FrameRange } from "./phases";

/** Joints tracked for posture, each a midpoint of its (visible) landmarks. */
const POSTURE_JOINTS: ReadonlyArray<{ id: string; indices: number[] }> = [
  { id: "head", indices: [LANDMARK_INDICES.NOSE] },
  {
    id: "shoulders",
    indices: [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.RIGHT_SHOULDER],
  },
  { id: "hips", indices: [LANDMARK_INDICES.LEFT_HIP, LANDMARK_INDICES.RIGHT_HIP] },
  {
    id: "knees",
    indices: [LANDMARK_INDICES.LEFT_KNEE, LANDMARK_INDICES.RIGHT_KNEE],
  },
  {
    id: "ankles",
    indices: [LANDMARK_INDICES.LEFT_ANKLE, LANDMARK_INDICES.RIGHT_ANKLE],
  },
];

/** Signed, body-scaled forward offset of a joint's midpoint, or null. */
function jointForwardOffset(
  frame: Frame,
  indices: number[],
  orientation: string,
): number | null {
  const xs = indices
    .map((i) => pt(frame, i))
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .map((l) => l.x);
  if (xs.length === 0) return null;
  const x = xs.reduce((a, b) => a + b, 0) / xs.length;
  const centerX = centerOfFeetX(frame);
  const scale = bodyScaleY(frame);
  const sign = orientationSign(orientation);
  if (centerX === null || scale === null || sign === 0) return null;
  return (sign * (x - centerX)) / scale;
}

export type FrameLookup = (frameIndex: number) => Frame | null;

/**
 * Posture over a phase: `<joint>_start`, `<joint>_end`, and `<joint>_delta`
 * for each tracked joint.
 */
export function posturePhase(
  getFrame: FrameLookup,
  range: FrameRange,
  orientation: string,
): Record<string, Measurement> {
  const out: Record<string, Measurement> = {};
  const startFrame = getFrame(range.start);
  const endFrame = getFrame(range.end);
  for (const joint of POSTURE_JOINTS) {
    const s =
      startFrame && jointForwardOffset(startFrame, joint.indices, orientation);
    const e =
      endFrame && jointForwardOffset(endFrame, joint.indices, orientation);
    const sv = typeof s === "number" ? s : null;
    const ev = typeof e === "number" ? e : null;
    out[`${joint.id}_start`] =
      sv !== null
        ? measure(sv, [range.start])
        : unavailable("posture needs a side view", [range.start]);
    out[`${joint.id}_end`] =
      ev !== null
        ? measure(ev, [range.end])
        : unavailable("posture needs a side view", [range.end]);
    out[`${joint.id}_delta`] =
      sv !== null && ev !== null
        ? measure(ev - sv, [range.start, range.end])
        : unavailable("posture needs a side view", [range.start, range.end]);
  }
  return out;
}

/** Posture at a single frame (snapshot phases): `<joint>` per joint. */
export function postureSnapshot(
  getFrame: FrameLookup,
  frameIndex: number,
  orientation: string,
): Record<string, Measurement> {
  const out: Record<string, Measurement> = {};
  const frame = getFrame(frameIndex);
  for (const joint of POSTURE_JOINTS) {
    const v = frame && jointForwardOffset(frame, joint.indices, orientation);
    out[joint.id] =
      typeof v === "number"
        ? measure(v, [frameIndex])
        : unavailable("posture needs a side view", [frameIndex]);
  }
  return out;
}
