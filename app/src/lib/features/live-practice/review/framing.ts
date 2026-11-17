/**
 * Shot-review framing: ONE fixed transform for the whole shot that
 *  - keeps the source's true proportions (uniform scale — landmarks are
 *    normalized 0..1 on EACH axis, so drawing x·stageW, y·stageH stretches the
 *    body whenever the stage and the camera differ in aspect; that is what made
 *    poses look rotated/sheared), and
 *  - zooms so the whole movement fills the stage: the union of every frame's
 *    visible joints (highest reach at release, lowest point in the dip) is
 *    just inside the edges. No per-frame re-centering, so the player moves
 *    naturally through a still frame, like the original video.
 *
 * The same transform positions the video clip, so footage and skeleton stay
 * registered.
 *
 * Pure.
 */

export interface FramingLandmark {
  readonly x: number;
  readonly y: number;
  readonly visibility: number;
}
export interface FramingFrame {
  readonly landmarks: readonly FramingLandmark[];
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Framing {
  /** Screen px per unit of source HEIGHT (source is aspect × 1). */
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  /** Source width ÷ height used. */
  readonly aspect: number;
  /** True when the aspect was estimated (shot saved without its size). */
  readonly approximate: boolean;
}

export const MIN_VIS = 0.3;
/** Margin around the shot's extent, as a fraction of that extent. */
export const DEFAULT_PAD = 0.06;
/** Common camera aspect ratios (width ÷ height) estimates snap to. */
export const COMMON_ASPECTS = [9 / 16, 3 / 4, 4 / 3, 16 / 9] as const;

/** Limb segments whose length is constant in reality (MediaPipe indexes). */
const SEGMENTS: readonly [number, number][] = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16], // upper arms, forearms
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28], // thighs, shins
  [11, 23],
  [12, 24], // torso sides
];

/** Mean coefficient of variation of segment lengths at aspect `a`. */
function lengthSpread(frames: readonly FramingFrame[], a: number): number {
  let total = 0;
  let n = 0;
  for (const [i, j] of SEGMENTS) {
    const lens: number[] = [];
    for (const f of frames) {
      const p = f.landmarks[i];
      const q = f.landmarks[j];
      // Only clearly-tracked joints: occluded ones jitter and bias the fit.
      if (!p || !q || Math.min(p.visibility, q.visibility) < 0.8) continue;
      lens.push(Math.hypot((p.x - q.x) * a, p.y - q.y));
    }
    if (lens.length < 6) continue;
    const mean = lens.reduce((s, v) => s + v, 0) / lens.length;
    if (mean <= 0) continue;
    const sd = Math.sqrt(
      lens.reduce((s, v) => s + (v - mean) ** 2, 0) / lens.length,
    );
    total += sd / mean;
    n += 1;
  }
  return n > 0 ? total / n : Infinity;
}

/**
 * Estimates the source aspect (width ÷ height) from the skeleton alone, for
 * shots saved without their frame size: limbs keep their length as they
 * rotate only when x and y are scaled correctly, so pick the aspect that makes
 * segment lengths most constant, then snap to the nearest common camera ratio.
 * On the labeled clips this always gets portrait vs landscape right; raw
 * estimates read ~5–25% wide, so 9:16 vs 3:4 can still snap wrong — hence
 * `approximate`. Null when there's too little motion to tell.
 */
export function estimateAspect(frames: readonly FramingFrame[]): number | null {
  let best = Infinity;
  let bestA = 0;
  for (let a = 0.3; a <= 2.7; a += 0.02) {
    const s = lengthSpread(frames, a);
    if (s < best) {
      best = s;
      bestA = a;
    }
  }
  if (!Number.isFinite(best)) return null;
  let snapped: number = COMMON_ASPECTS[0];
  for (const c of COMMON_ASPECTS) {
    if (Math.abs(Math.log(c / bestA)) < Math.abs(Math.log(snapped / bestA))) {
      snapped = c;
    }
  }
  return snapped;
}

/** Normalized bounding box of every visible joint across all frames. */
export function shotBounds(
  frames: readonly FramingFrame[],
  minVis = MIN_VIS,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const f of frames) {
    for (const l of f.landmarks) {
      if (l.visibility < minVis) continue;
      if (l.x < minX) minX = l.x;
      if (l.y < minY) minY = l.y;
      if (l.x > maxX) maxX = l.x;
      if (l.y > maxY) maxY = l.y;
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/**
 * The fixed transform for a shot on a stage. `source` is the real frame size
 * when known (preferred — or the clip's video size); otherwise the aspect is
 * estimated from the pose (`approximate: true`), defaulting to portrait 9:16.
 */
export function computeShotFraming(
  frames: readonly FramingFrame[],
  stage: Size,
  source: Size | null,
  opts: { pad?: number; minVis?: number } = {},
): Framing | null {
  const bounds = shotBounds(frames, opts.minVis);
  if (!bounds || stage.width <= 0 || stage.height <= 0) return null;
  const known = source && source.width > 0 && source.height > 0;
  const aspect = known
    ? source.width / source.height
    : (estimateAspect(frames) ?? 9 / 16);

  // Extent in "source units": x · aspect, y · 1.
  const w = Math.max((bounds.maxX - bounds.minX) * aspect, 1e-3);
  const h = Math.max(bounds.maxY - bounds.minY, 1e-3);
  const pad = opts.pad ?? DEFAULT_PAD;
  const padded = {
    w: w + 2 * pad * Math.max(w, h),
    h: h + 2 * pad * Math.max(w, h),
  };
  const scale = Math.min(stage.width / padded.w, stage.height / padded.h);
  const cx = ((bounds.minX + bounds.maxX) / 2) * aspect;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    offsetX: stage.width / 2 - cx * scale,
    offsetY: stage.height / 2 - cy * scale,
    aspect,
    approximate: !known,
  };
}

/** Maps a normalized landmark to stage pixels under a framing. */
export function projectWith(
  f: Framing,
): (l: { x: number; y: number }) => { x: number; y: number } {
  return (l) => ({
    x: f.offsetX + l.x * f.aspect * f.scale,
    y: f.offsetY + l.y * f.scale,
  });
}

/** Where the full source frame (e.g. the video) lands on the stage. */
export function sourceRect(f: Framing): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return {
    left: f.offsetX,
    top: f.offsetY,
    width: f.aspect * f.scale,
    height: f.scale,
  };
}
