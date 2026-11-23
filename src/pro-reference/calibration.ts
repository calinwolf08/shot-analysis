/**
 * Per-player calibration from photos (or short clips) of the player standing
 * straight:
 *
 *  - FRONT-ON: the true shoulder / hip width ÷ torso length — what the
 *    camera-angle estimate needs instead of population proportions.
 *  - SIDE-ON: the true thigh, shin, upper-arm and forearm lengths ÷ torso —
 *    what the per-segment correction needs (how far a limb tips toward /
 *    away from the camera, from how short it looks).
 *
 * Measured with MediaPipe on the photo itself (its "shoulder" / "hip" points
 * aren't a tape measure's), median over the frames given. Each view is
 * checked: a "front-on" photo whose shoulders look narrow isn't front-on, a
 * "side-on" one whose shoulders look wide isn't side-on. Pure.
 */
import { MIN_VIS, widthRatios, type SignalFrame } from "../metrics/v3";

export type CalibrationView = "front" | "side";

export interface FrontCalibration {
  readonly shoulders: number;
  readonly hips: number;
}

export interface SideCalibration {
  readonly thigh: number | null;
  readonly shin: number | null;
  readonly upperArm: number | null;
  readonly forearm: number | null;
}

export interface PlayerCalibration {
  readonly front?: FrontCalibration & {
    readonly frames: number;
    readonly at: string;
  };
  readonly side?: SideCalibration & {
    readonly frames: number;
    readonly at: string;
  };
}

export interface CalibrationResult<T> {
  readonly values: T | null;
  /** Frames with a usable pose. */
  readonly frames: number;
  /** Problems to show before saving (empty = looks right). */
  readonly warnings: readonly string[];
}

/** A front-on photo's shoulders are at least this wide (÷ torso). */
export const FRONT_MIN_SHOULDERS = 0.55;
/** A side-on photo's shoulders are at most this wide (÷ torso, ≈ 20°). */
export const SIDE_MAX_SHOULDERS = 0.27;

const median = (xs: readonly number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export function frontCalibration(
  frames: readonly SignalFrame[],
  aspect: number,
): CalibrationResult<FrontCalibration> {
  const r = frames
    .map((f) => widthRatios(f, aspect))
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (r.length === 0) {
    return {
      values: null,
      frames: 0,
      warnings: ["No pose with both shoulders and both hips found."],
    };
  }
  const shoulders = median(r.map((x) => x.shoulders))!;
  const hips = median(r.map((x) => x.hips))!;
  const warnings: string[] = [];
  if (shoulders < FRONT_MIN_SHOULDERS)
    warnings.push(
      `Shoulders look narrow (${shoulders.toFixed(2)} × torso): the photo may not be front-on.`,
    );
  if (hips > shoulders)
    warnings.push("Hips look wider than shoulders: check the skeleton.");
  return { values: { shoulders, hips }, frames: r.length, warnings };
}

const SEG = {
  thigh: [
    [23, 25],
    [24, 26],
  ],
  shin: [
    [25, 27],
    [26, 28],
  ],
  upperArm: [
    [11, 13],
    [12, 14],
  ],
  forearm: [
    [13, 15],
    [14, 16],
  ],
} as const;

export function sideCalibration(
  frames: readonly SignalFrame[],
  aspect: number,
): CalibrationResult<SideCalibration> {
  const vals: Record<keyof SideCalibration, number[]> = {
    thigh: [],
    shin: [],
    upperArm: [],
    forearm: [],
  };
  let used = 0;
  const wide: number[] = [];
  for (const f of frames) {
    const w = widthRatios(f, aspect);
    if (!w) continue;
    used++;
    wide.push(w.shoulders);
    const L = f.landmarks!;
    const P = (i: number) => {
      const l = L[i];
      return l && l.visibility >= MIN_VIS ? { x: l.x * aspect, y: l.y } : null;
    };
    for (const k of Object.keys(SEG) as (keyof SideCalibration)[]) {
      // The longer visible side (the near limb isn't foreshortened by the
      // body's own width; the far one may be partly hidden).
      let best: number | null = null;
      for (const [a, b] of SEG[k]) {
        const p = P(a);
        const q = P(b);
        if (!p || !q) continue;
        const len = Math.hypot(p.x - q.x, p.y - q.y) / w.torso;
        best = best === null ? len : Math.max(best, len);
      }
      if (best !== null) vals[k].push(best);
    }
  }
  if (used === 0) {
    return {
      values: null,
      frames: 0,
      warnings: ["No pose with both shoulders and both hips found."],
    };
  }
  const values: SideCalibration = {
    thigh: median(vals.thigh),
    shin: median(vals.shin),
    upperArm: median(vals.upperArm),
    forearm: median(vals.forearm),
  };
  const warnings: string[] = [];
  const sh = median(wide)!;
  if (sh > SIDE_MAX_SHOULDERS)
    warnings.push(
      `Shoulders look wide (${sh.toFixed(2)} × torso): the photo may not be side-on, so limbs may look short.`,
    );
  for (const [k, v] of Object.entries(values))
    if (v === null) warnings.push(`${k} not visible.`);
  // Typical MediaPipe ratios (÷ torso): thigh/shin ~0.8–1.1, arms ~0.5–0.75.
  if (values.thigh !== null && (values.thigh < 0.6 || values.thigh > 1.4))
    warnings.push(
      `Thigh ${values.thigh.toFixed(2)} × torso looks unusual: is the leg straight?`,
    );
  if (values.shin !== null && (values.shin < 0.6 || values.shin > 1.4))
    warnings.push(
      `Shin ${values.shin.toFixed(2)} × torso looks unusual: is the leg straight?`,
    );
  return { values, frames: used, warnings };
}

/** The frontal widths to use for a player (calibration, else clips, else defaults). */
export function frontalFor(
  calibration: PlayerCalibration | undefined,
  fromClips: { frontalObserved: boolean; frontal: FrontCalibration } | null,
): FrontCalibration | undefined {
  if (calibration?.front)
    return {
      shoulders: calibration.front.shoulders,
      hips: calibration.front.hips,
    };
  if (fromClips?.frontalObserved) return fromClips.frontal;
  return undefined;
}

/** Parses a player.json `calibration` value (anything malformed is dropped). */
export function parseCalibration(raw: unknown): PlayerCalibration | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, Record<string, unknown> | undefined>;
  const n = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const out: {
    front?: NonNullable<PlayerCalibration["front"]>;
    side?: NonNullable<PlayerCalibration["side"]>;
  } = {};
  const f = r.front;
  if (f && n(f.shoulders) !== null && n(f.hips) !== null) {
    out.front = {
      shoulders: n(f.shoulders)!,
      hips: n(f.hips)!,
      frames: n(f.frames) ?? 0,
      at: typeof f.at === "string" ? f.at : "",
    };
  }
  const s = r.side;
  if (s && typeof s === "object") {
    out.side = {
      thigh: n(s.thigh),
      shin: n(s.shin),
      upperArm: n(s.upperArm),
      forearm: n(s.forearm),
      frames: n(s.frames) ?? 0,
      at: typeof s.at === "string" ? s.at : "",
    };
  }
  return out.front || out.side ? out : undefined;
}
