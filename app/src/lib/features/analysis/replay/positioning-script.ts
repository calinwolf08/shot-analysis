/**
 * Scripted positioning streams for replay e2e (`?replayScript=`). Generates a
 * still, standing player in a given stance so readiness scenarios ("facing the
 * camera, then turns side-on") can be driven deterministically without
 * footage. After the script, the replay continues with the fixture's frames.
 *
 * Script syntax: comma-separated `kind[:seconds]` (default 4 s), e.g.
 *   facing:3,wrongside:3,side:8
 *
 * Kinds:
 *   none       no pose detected
 *   facing     facing the camera, whole body visible
 *   side       side-on, shooting-arm side nearest, far side occluded (low
 *              visibility — as real side-on MediaPipe output looks)
 *   wrongside  side-on, guide-arm side nearest
 *   cutoff     side-on (correct side) but feet below the frame edge
 */
import type { LandmarkFrame } from "../types";

export type ScriptKind = "none" | "facing" | "side" | "wrongside" | "cutoff";

export interface ScriptSegment {
  readonly kind: ScriptKind;
  readonly seconds: number;
}

const KINDS: readonly ScriptKind[] = [
  "none",
  "facing",
  "side",
  "wrongside",
  "cutoff",
];

/** Parses `facing:3,side:8`; unknown kinds/garbage are skipped. */
export function parsePositioningScript(spec: string | null): ScriptSegment[] {
  if (!spec) return [];
  const out: ScriptSegment[] = [];
  for (const part of spec.split(",")) {
    const [rawKind, rawSec] = part.trim().split(":");
    const kind = rawKind as ScriptKind;
    if (!KINDS.includes(kind)) continue;
    const sec = rawSec === undefined ? 4 : Number(rawSec);
    if (!Number.isFinite(sec) || sec <= 0) continue;
    out.push({ kind, seconds: sec });
  }
  return out;
}

type Lm = {
  x: number;
  y: number;
  z: number;
  visibility: number;
  confidence: number;
};

const lm = (x: number, y: number, z: number, visibility: number): Lm => ({
  x,
  y,
  z,
  visibility,
  confidence: visibility,
});

/** Left/right landmark index pairs (MediaPipe pose). */
const PAIRS: readonly [number, number][] = [
  [1, 4],
  [2, 5],
  [3, 6],
  [7, 8],
  [9, 10],
  [11, 12],
  [13, 14],
  [15, 16],
  [17, 18],
  [19, 20],
  [21, 22],
  [23, 24],
  [25, 26],
  [27, 28],
  [29, 30],
  [31, 32],
];

/** Body heights (normalized y) for each landmark pair, head → toe. */
const Y: Record<number, number> = {
  0: 0.2,
  1: 0.19,
  2: 0.19,
  3: 0.19,
  7: 0.2,
  9: 0.22,
  11: 0.28,
  13: 0.4,
  15: 0.5,
  17: 0.52,
  19: 0.52,
  21: 0.51,
  23: 0.52,
  25: 0.7,
  27: 0.86,
  29: 0.88,
  31: 0.89,
};

function yOf(i: number): number {
  const left = PAIRS.find(([l, r]) => l === i || r === i)?.[0] ?? i;
  return Y[left] ?? Y[i] ?? 0.5;
}

/**
 * One standing frame. `nearSide` only matters for side views. `drop` shifts
 * the body down (feet out of frame for "cutoff").
 */
export function standingLandmarks(
  view: "facing" | "side",
  nearSide: "left" | "right",
  drop = 0,
): Lm[] {
  const out: Lm[] = new Array(33);
  const cx = 0.5;
  out[0] = lm(cx, yOf(0) + drop, -0.3, 0.99);
  for (const [l, r] of PAIRS) {
    const y = yOf(l) + drop;
    // Out of frame → MediaPipe reports low visibility.
    const visible = y <= 1 ? 1 : 0.1;
    if (view === "facing") {
      // Shoulders/hips spread across the screen, equal depth.
      const half =
        l === 11 || l === 13 || l === 15 ? 0.09 : l === 23 ? 0.06 : 0.05;
      // Person's left appears on screen-right when facing the camera.
      out[l] = lm(cx + half, y, -0.1, 0.99 * visible);
      out[r] = lm(cx - half, y, -0.1, 0.99 * visible);
    } else {
      const nearIdx = nearSide === "left" ? l : r;
      const farIdx = nearSide === "left" ? r : l;
      out[nearIdx] = lm(cx + 0.01, y, -0.25, 0.99 * visible);
      // Far side: nearly overlapping in x, deeper, mostly occluded.
      out[farIdx] = lm(cx - 0.01, y, 0.25, 0.2 * visible);
    }
  }
  return out;
}

/** Landmarks for a script kind, or null for "none". */
export function landmarksFor(
  kind: ScriptKind,
  shootingSide: "left" | "right",
): Lm[] | null {
  const guideSide = shootingSide === "left" ? "right" : "left";
  switch (kind) {
    case "none":
      return null;
    case "facing":
      return standingLandmarks("facing", shootingSide);
    case "side":
      return standingLandmarks("side", shootingSide);
    case "wrongside":
      return standingLandmarks("side", guideSide);
    case "cutoff":
      return standingLandmarks("side", shootingSide, 0.2);
  }
}

/**
 * Expands a script into frames at `fps` with timestamps from 0. A tiny
 * deterministic sway keeps it from being perfectly static (not enough to
 * trigger a rep).
 */
export function scriptFrames(
  segments: readonly ScriptSegment[],
  fps: number,
  shootingSide: "left" | "right",
): LandmarkFrame[] {
  const frames: LandmarkFrame[] = [];
  const dt = 1000 / fps;
  for (const seg of segments) {
    const base = landmarksFor(seg.kind, shootingSide);
    const n = Math.round(seg.seconds * fps);
    for (let k = 0; k < n; k++) {
      const i = frames.length;
      const sway = 0.002 * Math.sin(i / 7);
      frames.push({
        frameIndex: i,
        timestamp: i * dt,
        poseConfidence: base ? 0.95 : 0,
        landmarks: base ? base.map((l) => ({ ...l, x: l.x + sway })) : null,
      });
    }
  }
  return frames;
}
