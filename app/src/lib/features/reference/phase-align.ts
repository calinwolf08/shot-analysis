/**
 * Phase-time alignment for the side-by-side compare (dev viewer): two shots
 * are played on one shared "phase clock" in which every phase lasts the same,
 * so Load starts, the low point, set point and arm extension land at the same
 * moment on both stages however fast each player moved.
 *
 * The clock `u` runs over ALIGN_SEGMENTS (each segment = 1 unit):
 *   Before (PAD frames) → Load → Rise → Release → After (PAD frames).
 * Integer `u` = a boundary; within a segment frames are interpolated linearly.
 *
 * Pure.
 */
import {
  computeShotMetricsV3,
  type ShotMetricsV3,
  type SignalFrame,
} from "basketball-shot-analysis";
import type { ShotReviewPoses } from "$lib/shared/db/repos";
import { estimateAspect } from "$lib/features/live-practice/review/framing";

export const ALIGN_SEGMENTS = [
  "Before",
  "Load",
  "Rise",
  "Release",
  "After",
] as const;
export type AlignSegment = (typeof ALIGN_SEGMENTS)[number];
/** Boundary names (u = 1…4). */
export const ALIGN_BOUNDARIES = [
  "Load starts",
  "Lowest point",
  "Set point",
  "Arm extended",
] as const;
export const ALIGN_SPAN = ALIGN_SEGMENTS.length;

/** Frames of lead-in / follow-through shown around the phases. */
export const ALIGN_PAD_FRAMES = 8;

/** Phase anchors as fractional source frames. */
export interface PhaseAnchors {
  readonly loadStart: number;
  readonly loadEnd: number;
  readonly setPoint: number;
  readonly armExtended: number;
}

/** Anchors from v3 metrics (null when any phase wasn't detected). */
export function anchorsFrom(m: ShotMetricsV3): PhaseAnchors | null {
  const { load, rise, release } = m.phases;
  if (!load || !rise || !release) return null;
  return {
    loadStart: load.start,
    loadEnd: load.end,
    setPoint: rise.end,
    armExtended: release.end,
  };
}

function knots(a: PhaseAnchors, pad: number): number[] {
  return [
    a.loadStart - pad,
    a.loadStart,
    a.loadEnd,
    a.setPoint,
    a.armExtended,
    a.armExtended + pad,
  ];
}

/** Source frame (fractional) at phase-clock `u` ∈ [0, ALIGN_SPAN]. */
export function frameAtPhaseTime(
  a: PhaseAnchors,
  u: number,
  pad = ALIGN_PAD_FRAMES,
): number {
  const k = knots(a, pad);
  const x = Math.max(0, Math.min(ALIGN_SPAN, u));
  const i = Math.min(ALIGN_SPAN - 1, Math.floor(x));
  return k[i]! + (x - i) * (k[i + 1]! - k[i]!);
}

/** Phase-clock `u` of a source frame (inverse of frameAtPhaseTime). */
export function phaseTimeAtFrame(
  a: PhaseAnchors,
  frame: number,
  pad = ALIGN_PAD_FRAMES,
): number {
  const k = knots(a, pad);
  if (frame <= k[0]!) return 0;
  for (let i = 0; i < ALIGN_SPAN; i++) {
    const lo = k[i]!;
    const hi = k[i + 1]!;
    if (frame <= hi) return hi > lo ? i + (frame - lo) / (hi - lo) : i;
  }
  return ALIGN_SPAN;
}

/** Segment shown at phase-clock `u` (boundaries belong to the next one). */
export function segmentAt(u: number): AlignSegment {
  const i = Math.max(0, Math.min(ALIGN_SPAN - 1, Math.floor(u + 1e-9)));
  return ALIGN_SEGMENTS[i]!;
}

/** "Release · at Set point" on a boundary, else the segment name. */
export function phaseLabel(u: number): string {
  const k = Math.round(u);
  const seg = segmentAt(u);
  return Math.abs(u - k) < 0.02 && k >= 1 && k <= ALIGN_BOUNDARIES.length
    ? `${seg} · at ${ALIGN_BOUNDARIES[k - 1]}`
    : seg;
}

/** Nearest stored frame (by frameIndex) to a fractional source frame. */
export function nearestFrame<T extends { frameIndex: number }>(
  frames: readonly T[],
  f: number,
): T | null {
  let best: T | null = null;
  let d = Infinity;
  for (const x of frames) {
    const dd = Math.abs(x.frameIndex - f);
    if (dd < d) {
      d = dd;
      best = x;
    }
  }
  return best;
}

/** v3 metrics for one of the player's stored shots (its review pose track). */
export function metricsForStoredShot(
  poses: ShotReviewPoses,
  shootingHand: "left" | "right",
): { metrics: ShotMetricsV3; aspect: number } {
  const aspect =
    poses.width && poses.height
      ? poses.width / poses.height
      : (estimateAspect(poses.frames) ?? 16 / 9);
  const fps = poses.fps || 30;
  const frames: SignalFrame[] = poses.frames.map((f) => ({
    frameIndex: f.frameIndex,
    // Stored t is ms on the capture clock; fall back to the frame index.
    timestamp: f.t !== undefined ? f.t : (f.frameIndex / fps) * 1000,
    landmarks: f.landmarks.map((l) => ({
      x: l.x,
      y: l.y,
      visibility: l.visibility,
    })),
  }));
  return {
    metrics: computeShotMetricsV3(frames, { aspect, shootingHand }),
    aspect,
  };
}
