/**
 * Camera angle off a true side view, estimated from the body (reference / pro
 * footage, where the court isn't in view).
 *
 * Seen exactly side-on, the shoulders (and hips) overlap: zero apparent width.
 * As the camera swings toward the front, their apparent width grows with
 * sin(angle). Torso length (mid-shoulders → mid-hips) is vertical, so the
 * camera's angle doesn't change it — it's the yardstick:
 *
 *   apparent width ÷ torso = frontal width ÷ torso × sin(angle)
 *
 * The frontal ratio is the shooter's own when known (`estimateProportions`,
 * from frames where they turn toward the camera), else population defaults.
 * Shoulders and hips are estimated separately: when they disagree by more
 * than `OPEN_DISAGREEMENT` the player is standing open or rotating.
 *
 * The estimate can't tell a camera in front of the side line from one behind
 * it; the 1 / cos stretch doesn't need to.
 */
import { FAR_VIS, type SignalFrame } from "./signals";

/** Population frontal width ÷ torso length for MediaPipe's landmarks. */
export const DEFAULT_FRONTAL = { shoulders: 0.8, hips: 0.5 } as const;
/** Shoulder vs hip estimates further apart than this (deg) → flag. */
export const OPEN_DISAGREEMENT = 8;

const SH = { left: 11, right: 12 } as const;
const HP = { left: 23, right: 24 } as const;

export interface WidthRatios {
  readonly frameIndex: number;
  /** Apparent shoulder width ÷ torso length. */
  readonly shoulders: number;
  /** Apparent hip width ÷ torso length. */
  readonly hips: number;
  /** Torso length (frame-height units, aspect-corrected). */
  readonly torso: number;
}

/** Per-frame apparent widths (null where a shoulder / hip is missing). */
export function widthRatios(
  frame: SignalFrame,
  aspect: number,
): WidthRatios | null {
  const L = frame.landmarks;
  if (!L) return null;
  const pts = [SH.left, SH.right, HP.left, HP.right].map((i) => L[i]);
  if (pts.some((l) => !l || l.visibility < FAR_VIS)) return null;
  const [ls, rs, lh, rh] = pts as NonNullable<(typeof pts)[number]>[];
  const x = (l: { x: number }) => l.x * aspect;
  const mx = (x(ls!) + x(rs!)) / 2;
  const my = (ls!.y + rs!.y) / 2;
  const hx = (x(lh!) + x(rh!)) / 2;
  const hy = (lh!.y + rh!.y) / 2;
  const torso = Math.hypot(mx - hx, my - hy);
  if (!(torso > 0)) return null;
  return {
    frameIndex: frame.frameIndex,
    shoulders: Math.abs(x(ls!) - x(rs!)) / torso,
    hips: Math.abs(x(lh!) - x(rh!)) / torso,
    torso,
  };
}

export interface CameraAngleEstimate {
  /** Degrees off side-on (mean of shoulders and hips). */
  readonly angle: number;
  readonly shoulders: number;
  readonly hips: number;
  /** |shoulders − hips| (deg). */
  readonly disagreement: number;
  /** Shoulders and hips disagree: standing open / rotating. */
  readonly standingOpen: boolean;
  /** Source frames the estimate used. */
  readonly frames: readonly number[];
  /** Frontal ratios used (the shooter's own, or the defaults). */
  readonly frontal: { readonly shoulders: number; readonly hips: number };
}

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const toAngle = (ratio: number, frontal: number) =>
  (Math.asin(Math.min(1, Math.max(0, ratio / frontal))) * 180) / Math.PI;

/**
 * Camera angle for one shot from the frames passed — the dip's start → the
 * set point works best (the shooter is squared to the basket; before the dip
 * they're often still turning into the shot). Null when no frame has both
 * shoulders and hips.
 */
export function estimateCameraAngle(
  frames: readonly SignalFrame[],
  opts: {
    aspect: number;
    frontal?: { shoulders: number; hips: number };
  },
): CameraAngleEstimate | null {
  const frontal = opts.frontal ?? DEFAULT_FRONTAL;
  const r = frames
    .map((f) => widthRatios(f, opts.aspect))
    .filter((x): x is WidthRatios => x !== null);
  if (r.length === 0) return null;
  const shoulders = toAngle(
    median(r.map((x) => x.shoulders)),
    frontal.shoulders,
  );
  const hips = toAngle(median(r.map((x) => x.hips)), frontal.hips);
  const disagreement = Math.abs(shoulders - hips);
  return {
    angle: (shoulders + hips) / 2,
    shoulders,
    hips,
    disagreement,
    standingOpen: disagreement > OPEN_DISAGREEMENT,
    frames: r.map((x) => x.frameIndex),
    frontal,
  };
}
