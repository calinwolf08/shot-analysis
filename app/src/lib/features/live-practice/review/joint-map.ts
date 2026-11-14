/**
 * Pure helpers for the review overlay (live redesign — review pass):
 *  - which MediaPipe landmark(s) a scored metric concerns (so off-target
 *    metrics can light up the right body part),
 *  - which reference keyframe stands in for each shot phase, and
 *  - a 2-point similarity transform that drops the hip-rooted reference pose
 *    into the player's (image-normalized) landmark space so a "where it should
 *    be" dot can be drawn next to the player's actual joint.
 *
 * Alignment is best-effort by design: two anchors (hip midpoint + shoulder
 * midpoint) fix translation, rotation and scale, which is enough to place a
 * target dot as a guide, not a pixel-exact ground truth.
 */

/** MediaPipe BlazePose landmark indices we reference by name. */
export const LM = {
  NOSE: 0,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
} as const;

export type Hand = "left" | "right";

/** Shooting-side joint (the hand that shoots). */
function shootingSide(hand: Hand, left: number, right: number): number {
  return hand === "right" ? right : left;
}
/** Guide-side joint (the off / non-shooting hand). */
function guideSide(hand: Hand, left: number, right: number): number {
  return hand === "right" ? left : right;
}

/**
 * The landmark indices a metric concerns, resolved for the shooting hand.
 * Returns [] for metrics with no single-joint anchor (sequencing / timing),
 * which simply get no joint highlight.
 */
export function landmarksForMetric(metricId: string, hand: Hand): number[] {
  const id = metricId.toLowerCase();
  // sequencing gaps are timing between events, not a body part
  if (id.startsWith("seq.")) return [];

  const name = id.includes(".") ? id.slice(id.indexOf(".") + 1) : id;

  // Order matters: more specific before generic.
  if (name.includes("guide_hand"))
    return [guideSide(hand, LM.L_WRIST, LM.R_WRIST)];
  if (name.includes("elbow"))
    return [shootingSide(hand, LM.L_ELBOW, LM.R_ELBOW)];
  if (name.includes("wrist"))
    return [shootingSide(hand, LM.L_WRIST, LM.R_WRIST)];
  if (name.includes("ball"))
    // ball is held at the shooting hand
    return [shootingSide(hand, LM.L_WRIST, LM.R_WRIST)];
  if (name.startsWith("shoulders")) return [LM.L_SHOULDER, LM.R_SHOULDER];
  if (name.startsWith("hips") || name.includes("hip"))
    return [LM.L_HIP, LM.R_HIP];
  if (
    name.startsWith("knees") ||
    name.includes("knee") ||
    name.includes("depth")
  )
    return [LM.L_KNEE, LM.R_KNEE];
  if (name.startsWith("ankles")) return [LM.L_ANKLE, LM.R_ANKLE];
  if (name.startsWith("head")) return [LM.NOSE];
  return [];
}

/** One representative reference keyframe per shot phase. */
export const PHASE_KEYFRAME: Record<string, string> = {
  gather: "legs_start_bending",
  load: "leg_bend_low_point",
  rise: "ball_starts_upward",
  setPoint: "set_point",
  release: "release",
  followThrough: "arms_fully_extended",
};

export interface Pt {
  readonly x: number;
  readonly y: number;
}

function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * A similarity transform (translation + uniform scale + rotation) that maps a
 * reference point into player space, fixed by two anchor pairs:
 * reference hip/shoulder midpoints → player hip/shoulder midpoints. Returns
 * null when the reference anchors are degenerate (can't define a scale/angle).
 *
 * This also absorbs the two spaces' differing axis conventions (the reference
 * pose is hip-rooted with y-up; player landmarks are image-normalized y-down),
 * because a rotation that aligns the hip→shoulder vectors handles the flip.
 */
export function similarityFromAnchors(
  refHip: Pt,
  refShoulder: Pt,
  playerHip: Pt,
  playerShoulder: Pt,
): ((p: Pt) => Pt) | null {
  const vrx = refShoulder.x - refHip.x;
  const vry = refShoulder.y - refHip.y;
  const vpx = playerShoulder.x - playerHip.x;
  const vpy = playerShoulder.y - playerHip.y;
  const denom = vrx * vrx + vry * vry;
  if (denom < 1e-9) return null;
  // k = vp / vr as complex numbers (rotation + scale).
  const kx = (vpx * vrx + vpy * vry) / denom;
  const ky = (vpy * vrx - vpx * vry) / denom;
  return (p: Pt): Pt => {
    const ax = p.x - refHip.x;
    const ay = p.y - refHip.y;
    // (kx + i·ky) · (ax + i·ay)
    return {
      x: playerHip.x + (kx * ax - ky * ay),
      y: playerHip.y + (kx * ay + ky * ax),
    };
  };
}

/**
 * Builds the reference→player transform from the two anchor midpoints of each
 * pose. `playerLm`/`refLm` are landmark arrays (index = MediaPipe index).
 * Returns null when any anchor landmark is missing.
 */
export function alignReferenceToPlayer(
  refLm: readonly Pt[],
  playerLm: readonly Pt[],
): ((p: Pt) => Pt) | null {
  const need = [LM.L_HIP, LM.R_HIP, LM.L_SHOULDER, LM.R_SHOULDER];
  if (need.some((i) => !refLm[i] || !playerLm[i])) return null;
  const refHip = mid(refLm[LM.L_HIP]!, refLm[LM.R_HIP]!);
  const refSho = mid(refLm[LM.L_SHOULDER]!, refLm[LM.R_SHOULDER]!);
  const plHip = mid(playerLm[LM.L_HIP]!, playerLm[LM.R_HIP]!);
  const plSho = mid(playerLm[LM.L_SHOULDER]!, playerLm[LM.R_SHOULDER]!);
  return similarityFromAnchors(refHip, refSho, plHip, plSho);
}
