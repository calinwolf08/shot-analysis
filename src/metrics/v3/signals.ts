/**
 * v3 per-frame body signals for one shot window.
 *
 * Fixes two problems in the v2 measurements:
 *  - **Aspect ratio.** Landmarks are normalized 0..1 on EACH axis, so angles
 *    computed directly on (x, y) are distorted on any non-square frame — and
 *    distorted differently for a landscape reference clip than for a portrait
 *    phone. Here x is scaled by the frame aspect (width ÷ height) first, so
 *    every angle and length is in true proportions.
 *  - **Timing.** Each frame keeps its real timestamp (frames may be unevenly
 *    spaced live), instead of assuming index ÷ fps.
 *
 * Signals are lightly smoothed (Savitzky–Golay, 5-point quadratic) after
 * short gaps (≤ 3 frames of missing/occluded joints) are bridged linearly.
 * Longer gaps stay null.
 *
 * Side conventions: the SHOOTING arm comes from the shooting hand; the legs
 * use the NEAR side (higher visibility over the window), since the far side
 * is occluded side-on. The torso's DIRECTION (lean, and the torso arm of the
 * hip angle) uses the CENTRE line, mid-hips → mid-shoulders, whenever both
 * sides are tracked: shoulders are wider than hips, so off a true side view
 * the near hip → near shoulder line tilts by the width difference (~12° at
 * 40° off side-on), while the centre line doesn't.
 *
 * `cameraAngle` (degrees off side-on; reference/pro data only) stretches
 * horizontal distances by 1 / cos(angle) — the foreshortening a camera that
 * isn't square to the shooter's side applies to front-to-back movement.
 */

export interface SignalLandmark {
  readonly x: number;
  readonly y: number;
  readonly visibility: number;
}
export interface SignalFrame {
  readonly frameIndex: number;
  /** Seconds. */
  readonly timestamp: number;
  readonly landmarks: readonly SignalLandmark[] | null;
}

export type Side = "left" | "right";
export type Series = (number | null)[];

export interface ShotSignals {
  /** Frame indexes covered (source indexes), one per sample. */
  readonly frameIndex: readonly number[];
  /** Seconds, one per sample. */
  readonly t: readonly number[];
  readonly aspect: number;
  readonly shootingSide: Side;
  readonly nearSide: Side;
  /** Torso direction measured on the centre line (else the near side). */
  readonly centreLine: boolean;
  /** Camera angle corrected for (deg off side-on; 0 = none). */
  readonly cameraAngle: number;
  /** Knee / elbow angles measured per segment in 3D (true lengths given). */
  readonly segments3d: boolean;
  /** Shooting wrist height (screen y, DOWN is +, units of frame height). */
  readonly wristY: Series;
  /** Near hip screen y. */
  readonly hipY: Series;
  /** Near knee angle hip-knee-ankle (deg; 180 = straight). */
  readonly kneeAngle: Series;
  /** Near hip angle shoulder-hip-knee (deg; 180 = upright). */
  readonly hipAngle: Series;
  /** Shooting elbow angle shoulder-elbow-wrist (deg). */
  readonly elbowAngle: Series;
  /**
   * Torso lean from vertical, mid-hips → mid-shoulders (near side when the
   * far side isn't tracked) (deg; sign: + = toward facing).
   */
  readonly spineLean: Series;
  /**
   * Head pitch: the near ear → nose line from horizontal, degrees; + = chin
   * DOWN (nose below the ear), − = chin up / head tilted back. Independent of
   * torso lean (the head can stay level while the torso leans).
   */
  readonly headPitch: Series;
  /** Wrist hinge: interior angle elbow-wrist-index (deg; smaller = more bent). */
  readonly wristAngle: Series;
  /** +1 if the player faces screen-right, −1 if screen-left. */
  readonly facing: 1 | -1;
  /**
   * Raw joint positions (aspect-scaled x, frame-height units; smoothed) for
   * positional metrics: shooting wrist/elbow/shoulder/index fingertip, near
   * hip/knee/ankle, head (near ear, else nose), guide wrist, and the torso
   * line's ends (`hipCentre`, `shoulderCentre`).
   */
  readonly pos: Readonly<Record<PosJoint, { x: Series; y: Series }>>;
  /** Per-sample visibility (unsmoothed) of joints that are often occluded. */
  readonly vis: Readonly<Record<"guideWrist" | "index", Series>>;
  /** Median segment lengths over the window (frame-height units). */
  readonly segments: Readonly<Record<SegmentName, number | null>>;
}

export type SegmentName = "thigh" | "shin" | "torso" | "forearm" | "upperArm";
export type PosJoint =
  | "wrist"
  | "elbow"
  | "hip"
  | "knee"
  | "ankle"
  | "head"
  | "guideWrist"
  /** Shooting shoulder / index fingertip. */
  | "shoulder"
  | "index"
  /** Mid-hips when the centre line is used, else the near hip. */
  | "hipCentre"
  /** Mid-shoulders when the centre line is used, else the near shoulder. */
  | "shoulderCentre";

const LM = {
  nose: 0,
  ear: { left: 7, right: 8 },
  shoulder: { left: 11, right: 12 },
  elbow: { left: 13, right: 14 },
  wrist: { left: 15, right: 16 },
  index: { left: 19, right: 20 },
  hip: { left: 23, right: 24 },
  knee: { left: 25, right: 26 },
  ankle: { left: 27, right: 28 },
} as const;

export const MIN_VIS = 0.3;
/**
 * The far shoulder / hip only need this much visibility for the centre line:
 * MediaPipe still places occluded joints sensibly, just with low confidence.
 */
export const FAR_VIS = 0.05;
/** Centre line used when both sides are tracked on this share of frames. */
export const CENTRE_LINE_MIN_SHARE = 0.7;
/** Largest camera angle a correction is applied for (beyond: clamped). */
export const MAX_CAMERA_ANGLE = 60;

type P = { x: number; y: number };

function pt(
  f: SignalFrame,
  i: number,
  aspect: number,
  minVis = MIN_VIS,
): P | null {
  const l = f.landmarks?.[i];
  if (!l || l.visibility < minVis) return null;
  return { x: l.x * aspect, y: l.y };
}

/** Interior angle at b (deg). */
export function angleAt(a: P, b: P, c: P): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const d = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (d === 0) return NaN;
  const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / d));
  return (Math.acos(cos) * 180) / Math.PI;
}

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

/** Fills interior gaps of up to `maxGap` nulls by linear interpolation. */
export function bridgeGaps(s: Series, maxGap = 3): Series {
  const out = [...s];
  let i = 0;
  while (i < out.length) {
    if (out[i] !== null) {
      i++;
      continue;
    }
    const startGap = i;
    while (i < out.length && out[i] === null) i++;
    const len = i - startGap;
    const before = out[startGap - 1];
    const after = out[i];
    if (
      len <= maxGap &&
      before !== null &&
      before !== undefined &&
      after !== null &&
      after !== undefined
    ) {
      for (let k = 0; k < len; k++) {
        out[startGap + k] = before + ((after - before) * (k + 1)) / (len + 1);
      }
    }
  }
  return out;
}

/** 5-point quadratic Savitzky–Golay; edges / gaps keep the raw value. */
export function smooth(s: Series): Series {
  const c = [-3, 12, 17, 12, -3];
  return s.map((v, i) => {
    if (v === null) return null;
    let acc = 0;
    for (let k = -2; k <= 2; k++) {
      const w = s[i + k];
      if (w === null || w === undefined) return v;
      acc += c[k + 2]! * w;
    }
    return acc / 35;
  });
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** The side whose leg/torso joints are more visible over the window. */
export function nearSideOf(frames: readonly SignalFrame[]): Side {
  let left = 0;
  let right = 0;
  for (const f of frames) {
    for (const j of ["shoulder", "hip", "knee", "ankle"] as const) {
      left += f.landmarks?.[LM[j].left]?.visibility ?? 0;
      right += f.landmarks?.[LM[j].right]?.visibility ?? 0;
    }
  }
  return left >= right ? "left" : "right";
}

/**
 * Frame times in SECONDS. Sources disagree on units: recorded pose files
 * (test-data, fixtures) store milliseconds despite the type's "seconds", the
 * live path stores seconds. Frame spacing tells them apart (no camera runs
 * slower than 1 fps); missing/flat timestamps fall back to index ÷ fps.
 */
export function frameTimesSeconds(
  frames: readonly SignalFrame[],
  fallbackFps = 30,
): number[] {
  const deltas: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    const d = frames[i]!.timestamp - frames[i - 1]!.timestamp;
    if (d > 0) deltas.push(d);
  }
  if (deltas.length === 0) {
    return frames.map((f) => f.frameIndex / fallbackFps);
  }
  const med = [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)]!;
  const scale = med > 1 ? 1 / 1000 : 1;
  return frames.map((f) => f.timestamp * scale);
}

export function computeSignals(
  frames: readonly SignalFrame[],
  opts: {
    aspect: number;
    shootingHand: Side;
    nearSide?: Side;
    fps?: number;
    /** Degrees off side-on (pro data): stretch x by 1 / cos(angle). */
    cameraAngle?: number;
    /**
     * True limb lengths ÷ torso length (calibration; pro data only): knee and
     * elbow angles are then measured in 3D per frame — see `limbVector3d`.
     */
    segmentLengths?: SegmentLengths;
  },
): ShotSignals {
  const cam = Math.min(MAX_CAMERA_ANGLE, Math.abs(opts.cameraAngle ?? 0));
  const a = opts.aspect / Math.cos((cam * Math.PI) / 180);
  const shoot = opts.shootingHand;
  const near = opts.nearSide ?? nearSideOf(frames);
  // Which way the player faces (+x or −x on screen): nose ahead of the ears.
  let facing = 0;
  for (const f of frames) {
    const n = pt(f, LM.nose, a);
    const e = pt(f, LM.ear[near], a);
    if (n && e) facing += n.x - e.x;
  }
  const facingSign = facing >= 0 ? 1 : -1;

  const far: Side = near === "left" ? "right" : "left";
  // Centre line for the torso when the far shoulder + hip are tracked often
  // enough (decided per window, so the signal never switches mid-shot).
  let both = 0;
  for (const f of frames) {
    if (
      pt(f, LM.shoulder[near], a) &&
      pt(f, LM.hip[near], a) &&
      pt(f, LM.shoulder[far], a, FAR_VIS) &&
      pt(f, LM.hip[far], a, FAR_VIS)
    )
      both++;
  }
  const centreLine =
    frames.length > 0 && both / frames.length >= CENTRE_LINE_MIN_SHARE;
  const mid = (p: P | null, q: P | null): P | null =>
    p && q ? { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } : null;

  const guide: Side = shoot === "left" ? "right" : "left";
  const headPitch: Series = [];
  const wristA: Series = [];
  const posRaw: Record<PosJoint, { x: Series; y: Series }> = {
    wrist: { x: [], y: [] },
    elbow: { x: [], y: [] },
    hip: { x: [], y: [] },
    knee: { x: [], y: [] },
    ankle: { x: [], y: [] },
    head: { x: [], y: [] },
    guideWrist: { x: [], y: [] },
    shoulder: { x: [], y: [] },
    index: { x: [], y: [] },
    hipCentre: { x: [], y: [] },
    shoulderCentre: { x: [], y: [] },
  };
  const visGuide: Series = [];
  const visIndex: Series = [];
  const wristY: Series = [];
  const hipY: Series = [];
  const knee: Series = [];
  const hipA: Series = [];
  const elbow: Series = [];
  const spine: Series = [];
  const seg3d = opts.segmentLengths
    ? perSegment3d(frames, opts.segmentLengths, {
        aspect: opts.aspect,
        cameraAngle: cam,
        near,
        shoot,
        far,
      })
    : null;
  const seg: Record<SegmentName, number[]> = {
    thigh: [],
    shin: [],
    torso: [],
    forearm: [],
    upperArm: [],
  };

  for (const f of frames) {
    const w = pt(f, LM.wrist[shoot], a);
    const e = pt(f, LM.elbow[shoot], a);
    const s = pt(f, LM.shoulder[shoot], a);
    const sn = pt(f, LM.shoulder[near], a);
    const h = pt(f, LM.hip[near], a);
    const k = pt(f, LM.knee[near], a);
    const an = pt(f, LM.ankle[near], a);
    wristY.push(w ? w.y : null);
    hipY.push(h ? h.y : null);
    // Torso direction: centre line (see header), else the near side.
    const top = centreLine
      ? mid(sn, pt(f, LM.shoulder[far], a, FAR_VIS))
      : sn;
    const base = centreLine ? mid(h, pt(f, LM.hip[far], a, FAR_VIS)) : h;
    knee.push(
      seg3d ? seg3d.knee(f) : h && k && an ? angleAt(h, k, an) : null,
    );
    // Hip angle: the torso direction, placed at the near hip, vs the thigh.
    hipA.push(
      top && base && h && k
        ? angleAt({ x: h.x + top.x - base.x, y: h.y + top.y - base.y }, h, k)
        : null,
    );
    elbow.push(
      seg3d ? seg3d.elbow(f) : s && e && w ? angleAt(s, e, w) : null,
    );
    spine.push(
      top && base
        ? (Math.atan2(facingSign * (top.x - base.x), base.y - top.y) * 180) /
            Math.PI
        : null,
    );
    const ear = pt(f, LM.ear[near], a) ?? pt(f, LM.nose, a);
    const idx = pt(f, LM.index[shoot], a);
    const g = pt(f, LM.wrist[guide], a, 0);
    // Pitch needs the real ear AND nose (no fallback): ear → nose direction
    // vs horizontal, x toward the facing direction, + = nose below the ear.
    const earOnly = pt(f, LM.ear[near], a);
    const nose = pt(f, LM.nose, a);
    headPitch.push(
      earOnly && nose && (nose.x !== earOnly.x || nose.y !== earOnly.y)
        ? (Math.atan2(nose.y - earOnly.y, facingSign * (nose.x - earOnly.x)) *
            180) /
            Math.PI
        : null,
    );
    wristA.push(e && w && idx ? angleAt(e, w, idx) : null);
    const put = (j: PosJoint, q: P | null) => {
      posRaw[j].x.push(q ? q.x : null);
      posRaw[j].y.push(q ? q.y : null);
    };
    put("wrist", w);
    put("elbow", e);
    put("hip", h);
    put("knee", k);
    put("ankle", an);
    put("head", ear);
    put("guideWrist", g);
    put("shoulder", s);
    put("index", idx);
    put("hipCentre", base);
    put("shoulderCentre", top);
    visGuide.push(f.landmarks?.[LM.wrist[guide]]?.visibility ?? null);
    visIndex.push(f.landmarks?.[LM.index[shoot]]?.visibility ?? null);
    if (h && k) seg.thigh.push(dist(h, k));
    if (k && an) seg.shin.push(dist(k, an));
    if (sn && h) seg.torso.push(dist(sn, h));
    if (e && w) seg.forearm.push(dist(e, w));
    if (s && e) seg.upperArm.push(dist(s, e));
  }

  const prep = (s: Series) => smooth(bridgeGaps(s));
  // Joint angles live in [0°, 180°]; smoothing can overshoot at the ends.
  const prepAngle = (s: Series) =>
    prep(s).map((v) => (v === null ? null : Math.max(0, Math.min(180, v))));
  return {
    frameIndex: frames.map((f) => f.frameIndex),
    t: frameTimesSeconds(frames, opts.fps),
    aspect: a,
    shootingSide: shoot,
    nearSide: near,
    centreLine,
    cameraAngle: cam,
    segments3d: !!seg3d,
    wristY: prep(wristY),
    hipY: prep(hipY),
    kneeAngle: prepAngle(knee),
    hipAngle: prepAngle(hipA),
    elbowAngle: prepAngle(elbow),
    spineLean: prep(spine),
    headPitch: prep(headPitch),
    wristAngle: prepAngle(wristA),
    facing: facingSign as 1 | -1,
    pos: Object.fromEntries(
      Object.entries(posRaw).map(([j, v]) => [j, { x: prep(v.x), y: prep(v.y) }]),
    ) as Record<PosJoint, { x: Series; y: Series }>,
    vis: { guideWrist: visGuide, index: visIndex },
    segments: {
      thigh: median(seg.thigh),
      shin: median(seg.shin),
      torso: median(seg.torso),
      forearm: median(seg.forearm),
      upperArm: median(seg.upperArm),
    },
  };
}

// ---- per-segment 3D (known limb lengths) ----------------------------------------

/** True limb lengths ÷ torso length (mid-shoulders → mid-hips). */
export interface SegmentLengths {
  readonly thigh: number | null;
  readonly shin: number | null;
  readonly upperArm: number | null;
  readonly forearm: number | null;
}

/** A limb counts as clearly tipped out of the picture below this share of its true length. */
export const FORESHORTENED = 0.9;

/**
 * A limb's 3D direction from its 2D image vector (true-aspect x, y).
 *
 * The depth (toward / away from the camera) a single view loses comes from:
 *  - its TRUE length, when the limb looks clearly short (|v| < 90% of L):
 *    depth = √(L² − |v|²) — this catches limbs leaving the side-on plane
 *    (elbow flaring, knees pushing out);
 *  - otherwise the side-on default: a limb in the shooter's side-on plane,
 *    seen `cameraAngle` off side-on, has depth = x × tan(angle). That is
 *    exactly the 1/cos stretch used for every other metric, so the two
 *    agree wherever the lengths say nothing.
 *
 * Which way the depth points is set by the limb's x direction (side-on
 * geometry); the overall front-of / behind-the-shooter sign flips every limb
 * together and so cancels out of joint angles. When x is too small to say
 * (< 15% of L), the previous frame's sign is kept.
 */
export function limbVector3d(
  v: { x: number; y: number },
  trueLength: number | null,
  tanAngle: number,
  prevSign: 1 | -1,
): { x: number; y: number; z: number; sign: 1 | -1 } {
  const len = Math.hypot(v.x, v.y);
  if (
    trueLength !== null &&
    trueLength > 0 &&
    len < FORESHORTENED * trueLength
  ) {
    const depth = Math.sqrt(trueLength * trueLength - len * len);
    const sign: 1 | -1 =
      Math.abs(v.x) < 0.15 * trueLength ? prevSign : v.x >= 0 ? 1 : -1;
    // Toward the side-on default's direction when the camera angle has one.
    const dir = tanAngle >= 0 ? 1 : -1;
    return { x: v.x, y: v.y, z: sign * dir * depth, sign };
  }
  const sign: 1 | -1 = v.x >= 0 ? 1 : -1;
  return { x: v.x, y: v.y, z: v.x * tanAngle, sign };
}

/** Interior angle between two 3D vectors from a joint (deg). */
export function angle3d(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const d = Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z);
  if (d === 0) return NaN;
  const c = (a.x * b.x + a.y * b.y + a.z * b.z) / d;
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** Knee (near side) and elbow (shooting side) angles per frame, in 3D. */
function perSegment3d(
  frames: readonly SignalFrame[],
  lengths: SegmentLengths,
  o: {
    aspect: number;
    cameraAngle: number;
    near: Side;
    shoot: Side;
    far: Side;
  },
): {
  knee(f: SignalFrame): number | null;
  elbow(f: SignalFrame): number | null;
} {
  // Raw (un-stretched) true-aspect coordinates: depth is added explicitly.
  const a = o.aspect;
  const tan = Math.tan((o.cameraAngle * Math.PI) / 180);
  // Torso length (mid-shoulders → mid-hips) over the window, in image units.
  const torsos: number[] = [];
  for (const f of frames) {
    const sn = pt(f, LM.shoulder[o.near], a);
    const sf = pt(f, LM.shoulder[o.far], a, FAR_VIS);
    const hn = pt(f, LM.hip[o.near], a);
    const hf = pt(f, LM.hip[o.far], a, FAR_VIS);
    if (sn && hn) {
      const top = sf ? { x: (sn.x + sf.x) / 2, y: (sn.y + sf.y) / 2 } : sn;
      const base = hf ? { x: (hn.x + hf.x) / 2, y: (hn.y + hf.y) / 2 } : hn;
      torsos.push(dist(top, base));
    }
  }
  const torso = median(torsos) ?? 0;
  const L = (r: number | null) => (r !== null && torso > 0 ? r * torso : null);
  const signs = { thigh: 1, shin: 1, upper: 1, fore: 1 } as Record<
    string,
    1 | -1
  >;
  const joint = (
    f: SignalFrame,
    ids: [number, number, number],
    l1: number | null,
    l2: number | null,
    k1: string,
    k2: string,
  ): number | null => {
    const p = pt(f, ids[0], a);
    const j = pt(f, ids[1], a);
    const q = pt(f, ids[2], a);
    if (!p || !j || !q) return null;
    const v1 = limbVector3d(
      { x: p.x - j.x, y: p.y - j.y },
      l1,
      tan,
      signs[k1]!,
    );
    const v2 = limbVector3d(
      { x: q.x - j.x, y: q.y - j.y },
      l2,
      tan,
      signs[k2]!,
    );
    signs[k1] = v1.sign;
    signs[k2] = v2.sign;
    return angle3d(v1, v2);
  };
  return {
    knee: (f) =>
      joint(
        f,
        [LM.hip[o.near], LM.knee[o.near], LM.ankle[o.near]],
        L(lengths.thigh),
        L(lengths.shin),
        "thigh",
        "shin",
      ),
    elbow: (f) =>
      joint(
        f,
        [LM.shoulder[o.shoot], LM.elbow[o.shoot], LM.wrist[o.shoot]],
        L(lengths.upperArm),
        L(lengths.forearm),
        "upper",
        "fore",
      ),
  };
}
