/**
 * A shooter's body proportions, from all of their clips (reference / pro
 * footage): segment lengths as ratios of torso length, and the frontal
 * shoulder / hip widths the camera-angle estimate needs.
 *
 *  - Segment lengths come from near-side-on frames (apparent shoulder width
 *    small), where the limbs face the camera and aren't foreshortened.
 *  - Frontal widths come from the WIDEST frames anywhere in the clips (the
 *    player turning toward the camera: walking back, between shots), at the
 *    95th percentile so one glitchy frame can't set them. When the player
 *    never turns close to front-on (`frontalObserved` false) the defaults
 *    apply.
 */
import { DEFAULT_FRONTAL, widthRatios } from "./camera-angle";
import { MIN_VIS, type SignalFrame } from "./signals";

export interface Proportions {
  /** Segment ÷ torso length (null when never seen side-on). */
  readonly thigh: number | null;
  readonly shin: number | null;
  readonly upperArm: number | null;
  readonly forearm: number | null;
  /** Frontal widths ÷ torso length (the shooter's own, or the defaults). */
  readonly frontal: { readonly shoulders: number; readonly hips: number };
  /** Whether the frontal widths were observed (else defaults). */
  readonly frontalObserved: boolean;
  /** Frames used: side-on (segments) and all with widths. */
  readonly sideOnFrames: number;
  readonly widthFrames: number;
}

/** Apparent shoulder width ÷ torso below this counts as side-on (≈ < 20°). */
export const SIDE_ON_RATIO = 0.27;
/**
 * Observed widths only replace the defaults when they're close to a true
 * front-on view (≥ 90% of the default ratio). A player who only ever turns
 * part-way (e.g. shoulders at 0.66 of torso length ≈ 55° off side-on) would
 * otherwise be taken as narrow, inflating every angle estimate.
 */
export const FRONTAL_MIN_SHARE = 0.9;
export const FRONTAL_MIN_RATIO = DEFAULT_FRONTAL.shoulders * FRONTAL_MIN_SHARE;

const LM = {
  shoulder: { left: 11, right: 12 },
  elbow: { left: 13, right: 14 },
  wrist: { left: 15, right: 16 },
  hip: { left: 23, right: 24 },
  knee: { left: 25, right: 26 },
  ankle: { left: 27, right: 28 },
} as const;

const median = (xs: readonly number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const quantile = (xs: readonly number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]!;
};

export function estimateProportions(
  clips: readonly { frames: readonly SignalFrame[]; aspect: number }[],
): Proportions {
  const shoulders: number[] = [];
  const hips: number[] = [];
  const seg: Record<"thigh" | "shin" | "upperArm" | "forearm", number[]> = {
    thigh: [],
    shin: [],
    upperArm: [],
    forearm: [],
  };
  let sideOn = 0;
  for (const { frames, aspect } of clips) {
    for (const f of frames) {
      const w = widthRatios(f, aspect);
      if (!w) continue;
      shoulders.push(w.shoulders);
      hips.push(w.hips);
      if (w.shoulders > SIDE_ON_RATIO) continue;
      sideOn++;
      const L = f.landmarks!;
      const P = (i: number) => {
        const l = L[i];
        return l && l.visibility >= MIN_VIS
          ? { x: l.x * aspect, y: l.y }
          : null;
      };
      // Both sides; each visible segment counts.
      for (const side of ["left", "right"] as const) {
        const add = (k: keyof typeof seg, a: number, b: number) => {
          const p = P(a);
          const q = P(b);
          if (p && q) seg[k].push(Math.hypot(p.x - q.x, p.y - q.y) / w.torso);
        };
        add("thigh", LM.hip[side], LM.knee[side]);
        add("shin", LM.knee[side], LM.ankle[side]);
        add("upperArm", LM.shoulder[side], LM.elbow[side]);
        add("forearm", LM.elbow[side], LM.wrist[side]);
      }
    }
  }
  const observed =
    shoulders.length > 0 && quantile(shoulders, 0.95) >= FRONTAL_MIN_RATIO;
  const hipsSeen =
    observed &&
    quantile(hips, 0.95) >= DEFAULT_FRONTAL.hips * FRONTAL_MIN_SHARE;
  return {
    thigh: median(seg.thigh),
    shin: median(seg.shin),
    upperArm: median(seg.upperArm),
    forearm: median(seg.forearm),
    frontal: observed
      ? {
          shoulders: quantile(shoulders, 0.95),
          hips: hipsSeen ? quantile(hips, 0.95) : DEFAULT_FRONTAL.hips,
        }
      : { ...DEFAULT_FRONTAL },
    frontalObserved: observed,
    sideOnFrames: sideOn,
    widthFrames: shoulders.length,
  };
}
