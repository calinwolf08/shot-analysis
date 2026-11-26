/**
 * Keyframe check catalog: body positions measured at five moments of the shot
 * (docs/keyframe-review-plan.md). Replaces the v3 phase/delta/timing metrics.
 *
 * A check id is `<keyframe>.<check>` (e.g. `rise.knee_bend`).
 *
 * Pure data.
 */

export const KEYFRAMES = [
  "setup",
  "load",
  "rise",
  "setPoint",
  "release",
] as const;
export type Keyframe = (typeof KEYFRAMES)[number];

export const CHECKS = [
  "hand_height",
  "ball_close",
  "wrist_hinge",
  "hold",
  "elbow_bend",
  "knee_bend",
  "back",
  "hips_over_knees",
] as const;
export type CheckId = (typeof CHECKS)[number];

export type CheckUnit = "deg" | "torso" | "thigh" | "s";

export const BODY_PARTS = ["hands", "elbow", "knees", "back", "hips"] as const;
export type BodyPart = (typeof BODY_PARTS)[number];

export interface CheckDef {
  readonly id: CheckId;
  /** Player-facing name ("Knee bend"). */
  readonly name: string;
  readonly part: BodyPart;
  readonly unit: CheckUnit;
  /** Keyframes this check is measured at. */
  readonly keyframes: readonly Keyframe[];
  /** One-line explanation (the "i" in the feedback sheet). */
  readonly help: string;
  /**
   * Text for a value BELOW / ABOVE the target band, always "<part> too
   * <direction>" so the fix is obvious. Shown as "<phrase> by N".
   */
  readonly low: string;
  readonly high: string;
}

const ALL: readonly Keyframe[] = KEYFRAMES;

/**
 * Sign conventions (see ./measure): angles in degrees, joint angles smaller =
 * more bent; heights + = higher; horizontal offsets + = toward the direction
 * the player faces; back lean + = leaning forward.
 */
export const CHECK_DEFS: Readonly<Record<CheckId, CheckDef>> = {
  hand_height: {
    id: "hand_height",
    name: "Hand height",
    part: "hands",
    unit: "torso",
    keyframes: ALL,
    help: "Where your hands are: against your hips at Setup and Load, against your head from Rise on.",
    low: "Hands too low",
    high: "Hands too high",
  },
  ball_close: {
    id: "ball_close",
    name: "Ball close to body",
    part: "hands",
    unit: "torso",
    keyframes: ["setup", "load"],
    help: "How far the ball is in front of your hips while you start the shot.",
    low: "Ball too close to body",
    high: "Ball too far from body",
  },
  wrist_hinge: {
    id: "wrist_hinge",
    name: "Wrist hinge",
    part: "hands",
    unit: "deg",
    keyframes: ALL,
    help: "How far your shooting wrist is cocked back under the ball.",
    low: "Wrist too bent",
    high: "Wrist too flat",
  },
  hold: {
    id: "hold",
    name: "Hold at set point",
    part: "hands",
    unit: "s",
    keyframes: ["setPoint"],
    help: "Time between the ball reaching set point and the release starting.",
    low: "Hold too short",
    high: "Hold too long",
  },
  elbow_bend: {
    id: "elbow_bend",
    name: "Elbow bend",
    part: "elbow",
    unit: "deg",
    keyframes: ALL,
    help: "The angle at your shooting elbow.",
    low: "Elbow too bent",
    high: "Elbow too straight",
  },
  knee_bend: {
    id: "knee_bend",
    name: "Knee bend",
    part: "knees",
    unit: "deg",
    keyframes: ALL,
    help: "How bent your knees are. Bent knees at Rise or Set point mean the legs are late.",
    low: "Knees too bent",
    high: "Knees too straight",
  },
  back: {
    id: "back",
    name: "Back posture",
    part: "back",
    unit: "deg",
    keyframes: ALL,
    help: "How far your torso leans forward or back.",
    low: "Leaning too far back",
    high: "Leaning too far forward",
  },
  hips_over_knees: {
    id: "hips_over_knees",
    name: "Hips over knees",
    part: "hips",
    unit: "thigh",
    keyframes: ALL,
    help: "Whether your hips sit over your knees or behind them.",
    low: "Hips too far back",
    high: "Hips too far forward",
  },
};

export const KEYFRAME_NAME: Readonly<Record<Keyframe, string>> = {
  setup: "Setup",
  load: "Load",
  rise: "Rise",
  setPoint: "Set point",
  release: "Release",
};

/** Spoken lead-in for a keyframe ("At release: hands too low by 1."). */
export const KEYFRAME_LEAD_IN: Readonly<Record<Keyframe, string>> = {
  setup: "At setup",
  load: "In the load",
  rise: "When the ball reaches set point",
  setPoint: "At set point",
  release: "At release",
};

export const BODY_PART_NAME: Readonly<Record<BodyPart, string>> = {
  hands: "Hands",
  elbow: "Elbow",
  knees: "Knees",
  back: "Back",
  hips: "Hips",
};

export const checkKey = (keyframe: Keyframe, check: CheckId): string =>
  `${keyframe}.${check}`;

export function parseCheckKey(
  key: string,
): { keyframe: Keyframe; check: CheckId } | null {
  const [k, c] = key.split(".");
  if (!(KEYFRAMES as readonly string[]).includes(k ?? "")) return null;
  if (!(CHECKS as readonly string[]).includes(c ?? "")) return null;
  const def = CHECK_DEFS[c as CheckId];
  if (!def.keyframes.includes(k as Keyframe)) return null;
  return { keyframe: k as Keyframe, check: c as CheckId };
}

/** Every check id, in keyframe order then catalog order. */
export const ALL_CHECK_KEYS: readonly string[] = KEYFRAMES.flatMap((k) =>
  CHECKS.filter((c) => CHECK_DEFS[c].keyframes.includes(k)).map((c) =>
    checkKey(k, c),
  ),
);
