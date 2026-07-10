/**
 * Live-practice setup readiness checks — small pure functions over pose
 * frames / pixel data / motion samples, composed by the setup screen.
 * Each check is overridable in the UI, so these only decide defaults.
 */
import type { LandmarkFrame } from "$lib/features/analysis";

/** Landmarks that must be visible for the "full body" check. */
const KEY_LANDMARKS = [0, 11, 12, 23, 24, 27, 28] as const; // head, shoulders, hips, ankles

export const CHECK_DEFAULTS = {
  minVisibility: 0.5,
  /** Full body must hold this long (ms of frame time). */
  fullBodySustainMs: 2000,
  /** Momentary visibility flickers shorter than this don't reset a hold. */
  sustainGraceMs: 250,
  /** Max normalized shoulder x-separation that still reads as side-on. */
  sideViewMaxShoulderSep: 0.09,
  /** Recent frames sampled for the side-view vote. */
  sideViewWindow: 30,
  /** Acceptable mean-luma band (0–255). */
  lumaMin: 60,
  lumaMax: 230,
  /** Max accel variance (m/s²)² that still counts as stable. */
  stabilityMaxVariance: 0.35,
} as const;

/** All key landmarks present and visible in this frame? */
export function isFullBodyVisible(
  frame: LandmarkFrame,
  minVisibility: number = CHECK_DEFAULTS.minVisibility,
): boolean {
  if (!frame.landmarks) return false;
  return KEY_LANDMARKS.every((i) => {
    const l = frame.landmarks![i];
    return l !== undefined && l.visibility >= minVisibility;
  });
}

/**
 * Tracks a boolean signal over frame time; passes once the signal has
 * held for `sustainMs`. Pose visibility flickers frame-to-frame, so
 * false samples shorter than `graceMs` don't reset the hold.
 */
export function createSustainedCheck(
  sustainMs: number,
  graceMs: number = CHECK_DEFAULTS.sustainGraceMs,
) {
  let trueSince: number | null = null;
  let lastTrueTs: number | null = null;
  return {
    update(value: boolean, timestamp: number): boolean {
      if (value) {
        trueSince ??= timestamp;
        lastTrueTs = timestamp;
        return timestamp - trueSince >= sustainMs;
      }
      if (lastTrueTs !== null && timestamp - lastTrueTs > graceMs) {
        trueSince = null;
        lastTrueTs = null;
      }
      return false;
    },
    reset() {
      trueSince = null;
      lastTrueTs = null;
    },
  };
}

/** Side view: shoulders nearly overlap horizontally (profile to camera). */
export function isSideViewFrame(
  frame: LandmarkFrame,
  maxShoulderSep: number = CHECK_DEFAULTS.sideViewMaxShoulderSep,
): boolean {
  const left = frame.landmarks?.[11];
  const right = frame.landmarks?.[12];
  if (!left || !right) return false;
  return Math.abs(left.x - right.x) <= maxShoulderSep;
}

/** Majority vote over the last N posed frames. */
export function isSideView(
  frames: readonly LandmarkFrame[],
  maxShoulderSep: number = CHECK_DEFAULTS.sideViewMaxShoulderSep,
): boolean {
  const posed = frames.filter((f) => f.landmarks !== null);
  if (posed.length === 0) return false;
  const votes = posed.filter((f) => isSideViewFrame(f, maxShoulderSep)).length;
  return votes / posed.length > 0.5;
}

/** Mean luma (Rec. 601) of RGBA pixel data, 0–255. */
export function meanLuma(data: Uint8ClampedArray): number {
  if (data.length < 4) return 0;
  let sum = 0;
  const pixels = Math.floor(data.length / 4);
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    sum += 0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]!;
  }
  return sum / pixels;
}

/** Lighting is workable when the mean luma sits inside the band. */
export function isLightingOk(
  data: Uint8ClampedArray,
  band: { min?: number; max?: number } = {},
): boolean {
  const luma = meanLuma(data);
  return (
    luma >= (band.min ?? CHECK_DEFAULTS.lumaMin) &&
    luma <= (band.max ?? CHECK_DEFAULTS.lumaMax)
  );
}

/**
 * Device stability from accelerometer magnitude samples. With fewer than
 * 5 samples (web without devicemotion) the check auto-passes — a propped
 * phone can't be measured, and the user can override anyway.
 */
export function isStable(
  accelMagnitudes: readonly number[],
  maxVariance: number = CHECK_DEFAULTS.stabilityMaxVariance,
): boolean {
  if (accelMagnitudes.length < 5) return true;
  const mean =
    accelMagnitudes.reduce((s, v) => s + v, 0) / accelMagnitudes.length;
  const variance =
    accelMagnitudes.reduce((s, v) => s + (v - mean) ** 2, 0) /
    accelMagnitudes.length;
  return variance <= maxVariance;
}
