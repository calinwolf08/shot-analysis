/**
 * Live orientation + side-aware "whole body in frame" checks for the
 * positioning gate.
 *
 * Why not the library's `detectOrientation`: it requires BOTH shoulders and
 * hips to be visible (≥ 0.3) and uses raw screen-space separation thresholds.
 * Side-on, the far-side joints are occluded, so it returns "unknown" exactly in
 * the pose the gate asks for; and raw separation shrinks as the player steps
 * back, so the same stance reads differently at different distances.
 *
 * Here:
 *  - separation is divided by torso height (distance-independent), and
 *    far-side landmark positions are used even when their visibility is low
 *    (MediaPipe still estimates them; only their confidence drops);
 *  - which side is nearest comes from depth (z) plus the near/far visibility
 *    asymmetry, which is strong side-on;
 *  - the body check needs the head plus the NEAR-side shoulder, hip, knee and
 *    ankle — never the occluded far side.
 *
 * Naming (matches labels + the library): "side-left" = the player's LEFT side
 * is nearest the camera; "side-right" = RIGHT side nearest.
 */
import type { LandmarkFrame } from "$lib/features/analysis";
import type { SideOrientation } from "./angle-gate";

/** MediaPipe pose landmark indexes used here. */
const LM = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

export type NearSide = "left" | "right";
export type FrameOrientation = SideOrientation | "front" | "unknown";

/** The side nearest the camera for a side-on orientation. */
export function nearSideOf(orientation: SideOrientation): NearSide {
  return orientation === "side-left" ? "left" : "right";
}

export interface NearSideBodyOptions {
  readonly nearSideMinVis: number;
  readonly headMinVis: number;
}

type Landmark = NonNullable<LandmarkFrame["landmarks"]>[number];

function inFrame(l: Landmark): boolean {
  // Small margin: MediaPipe can place an in-frame ankle a hair past the edge.
  return l.x >= -0.02 && l.x <= 1.02 && l.y >= -0.02 && l.y <= 1.02;
}

/**
 * The side actually nearest the camera in this frame (depth + visibility
 * asymmetry), or null when it can't be told (e.g. facing the camera, where
 * either side works for the body check).
 */
export function nearestSide(frame: LandmarkFrame): NearSide | null {
  if (!frame.landmarks) return null;
  const score = nearSideScore(frame.landmarks);
  if (Math.abs(score) < 0.02) return null;
  return score > 0 ? "left" : "right";
}

/**
 * Whole body in frame, judged on the near side only: head (nose or near ear)
 * plus near shoulder, hip, knee and ankle visible and inside the frame.
 *
 * `nearSide: "auto"` uses whichever side is actually nearest this frame — the
 * gate uses that, so a player showing the WRONG side hears "turn around", not
 * "step back" (the required side is the occluded one then). With no clear
 * nearest side, either side passing is enough.
 */
export function isNearSideBodyVisible(
  frame: LandmarkFrame,
  nearSide: NearSide | "auto",
  opts: NearSideBodyOptions,
): boolean {
  const lm = frame.landmarks;
  if (!lm) return false;
  if (nearSide === "auto") {
    const side = nearestSide(frame);
    return side
      ? isNearSideBodyVisible(frame, side, opts)
      : isNearSideBodyVisible(frame, "left", opts) ||
          isNearSideBodyVisible(frame, "right", opts);
  }
  const ok = (i: number, minVis: number) => {
    const l = lm[i];
    return l !== undefined && l.visibility >= minVis && inFrame(l);
  };
  const near =
    nearSide === "left"
      ? [LM.leftShoulder, LM.leftHip, LM.leftKnee, LM.leftAnkle]
      : [LM.rightShoulder, LM.rightHip, LM.rightKnee, LM.rightAnkle];
  const ear = nearSide === "left" ? LM.leftEar : LM.rightEar;
  const head = ok(LM.nose, opts.headMinVis) || ok(ear, opts.headMinVis);
  return head && near.every((i) => ok(i, opts.nearSideMinVis));
}

/**
 * Shoulder/hip horizontal spread divided by torso height — ~0.1–0.35 side-on,
 * ~0.6–0.9 facing the camera — or null when it can't be measured.
 */
export function torsoSeparation(frame: LandmarkFrame): number | null {
  const lm = frame.landmarks;
  if (!lm) return null;
  const ls = lm[LM.leftShoulder];
  const rs = lm[LM.rightShoulder];
  const lh = lm[LM.leftHip];
  const rh = lm[LM.rightHip];
  if (!ls || !rs || !lh || !rh) return null;
  // At least one shoulder must be genuinely tracked.
  if (Math.max(ls.visibility, rs.visibility) < 0.5) return null;
  const torso = Math.abs((ls.y + rs.y) / 2 - (lh.y + rh.y) / 2);
  if (torso < 0.02) return null;
  const spread = (Math.abs(ls.x - rs.x) + Math.abs(lh.x - rh.x)) / 2;
  return spread / torso;
}

/**
 * Which side faces the camera: positive = left nearer. Combines depth
 * (larger z = farther) with the near/far visibility asymmetry.
 */
function nearSideScore(lm: NonNullable<LandmarkFrame["landmarks"]>): number {
  const z = (i: number) => lm[i]?.z ?? 0;
  const v = (i: number) => lm[i]?.visibility ?? 0;
  const depth =
    (z(LM.rightShoulder) -
      z(LM.leftShoulder) +
      (z(LM.rightHip) - z(LM.leftHip))) /
    2;
  const pairs: [number, number][] = [
    [LM.leftShoulder, LM.rightShoulder],
    [LM.leftElbow, LM.rightElbow],
    [LM.leftHip, LM.rightHip],
    [LM.leftKnee, LM.rightKnee],
  ];
  const vis = pairs.reduce((s, [a, b]) => s + (v(a) - v(b)), 0) / pairs.length;
  return depth + vis;
}

/** Per-frame orientation. */
export function classifyFrameOrientation(
  frame: LandmarkFrame,
  maxSideSeparation: number,
): FrameOrientation {
  const sep = torsoSeparation(frame);
  if (sep === null || !frame.landmarks) return "unknown";
  if (sep > maxSideSeparation) return "front";
  const score = nearSideScore(frame.landmarks);
  if (Math.abs(score) < 0.02) return "unknown";
  return score > 0 ? "side-left" : "side-right";
}

export interface LiveOrientationResult {
  /** Majority orientation over the voted frames. */
  readonly orientation: FrameOrientation;
  /** Fraction of voted (posed) frames that read as `orientation`. */
  readonly agreement: number;
  /** Fraction of voted frames that read as the required side (if given). */
  readonly requiredAgreement: number;
}

/** Majority vote over recent frames. */
export function detectLiveOrientation(
  frames: readonly LandmarkFrame[],
  opts: { maxSideSeparation: number; required?: SideOrientation },
): LiveOrientationResult {
  const counts = new Map<FrameOrientation, number>();
  let voted = 0;
  for (const f of frames) {
    if (!f.landmarks) continue;
    const o = classifyFrameOrientation(f, opts.maxSideSeparation);
    counts.set(o, (counts.get(o) ?? 0) + 1);
    voted++;
  }
  if (voted === 0) {
    return { orientation: "unknown", agreement: 0, requiredAgreement: 0 };
  }
  let best: FrameOrientation = "unknown";
  let bestN = -1;
  for (const [o, n] of counts) {
    if (n > bestN) {
      best = o;
      bestN = n;
    }
  }
  return {
    orientation: best,
    agreement: bestN / voted,
    requiredAgreement: opts.required
      ? (counts.get(opts.required) ?? 0) / voted
      : 0,
  };
}
