/**
 * Keyframe scorecard (docs/keyframe-review-plan.md): each check at each
 * keyframe on the 0–10+ scale (0 = inside the reference band, +1 per
 * reference spread outside; display rounds up and caps at 10+).
 *
 * Only ENABLED checks count (the player's feedback filter): a turned-off check
 * is left out of the keyframe and overall scores, the worst list, the
 * on-screen text and the voice. Keyframe score = mean of its measured enabled
 * checks; overall = mean of the keyframe scores.
 *
 * Text: always "<part> too <direction> by N" ("Knees too bent by 5"); the
 * voice says the same words with a keyframe lead-in ("At release: hands too
 * low by 1.").
 *
 * Pure.
 */
import {
  ALL_CHECK_KEYS,
  BODY_PARTS,
  CHECK_DEFS,
  KEYFRAMES,
  KEYFRAME_LEAD_IN,
  KEYFRAME_NAME,
  parseCheckKey,
  scoreCheck,
  type BodyPart,
  type CheckId,
  type CheckUnit,
  type Keyframe,
  type KeyframeTargets,
  type ShotKeyframes,
} from "basketball-shot-analysis";
import { displayScore, wholeScore } from "../v3/score";

/** Below this share of measurable enabled checks the overall is withheld. */
export const COVERAGE_GATE = 0.5;
/** Checks fed back per shot (voice + practice card). */
export const FEEDBACK_COUNT = 3;

export interface CheckResult {
  /** `<keyframe>.<check>`. */
  readonly id: string;
  readonly keyframe: Keyframe;
  /** Same as `keyframe` (for helpers that order by phase). */
  readonly phase: Keyframe;
  readonly check: CheckId;
  readonly part: BodyPart;
  /** Check name ("Knee bend"). */
  readonly name: string;
  /** Same as `name` (for helpers written against labels). */
  readonly label: string;
  readonly unit: CheckUnit;
  /** Measured value (null = not measured). */
  readonly value: number | null;
  /** Why it wasn't measured. */
  readonly note: string | null;
  readonly scored: boolean;
  /** 0 = on target; +1 per reference spread outside the band; null = n/a. */
  readonly score: number | null;
  readonly direction: "low" | "high" | null;
  /** Distance outside the band, native units (0 inside). */
  readonly magnitude: number;
  readonly passMin: number;
  readonly passMax: number;
  /** "Knees too bent" — null when on target or not measured. */
  readonly phrase: string | null;
  /** Source frame it was measured at (null: keyframe not found). */
  readonly frame: number | null;
}

export interface KeyframeResult {
  readonly keyframe: Keyframe;
  readonly name: string;
  readonly score: number | null;
  /** Enabled checks at this keyframe, in catalog order. */
  readonly checks: readonly CheckResult[];
}

export interface KeyframeScorecard {
  readonly overall: number | null;
  readonly keyframes: readonly KeyframeResult[];
  /** Every enabled check, keyframe then catalog order. */
  readonly checks: readonly CheckResult[];
  /** Off-target enabled checks, worst first. */
  readonly worst: readonly CheckResult[];
  readonly measuredFraction: number;
  readonly belowCoverageGate: boolean;
}

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/** One check's result (also used for disabled checks by tools). */
export function scoreOne(
  id: string,
  shot: Pick<ShotKeyframes, "checks">,
  targets: KeyframeTargets,
): CheckResult | null {
  const key = parseCheckKey(id);
  const target = targets.checks[id];
  if (!key || !target) return null;
  const def = CHECK_DEFS[key.check];
  const m = shot.checks[id];
  const measured = !!m && m.reliable && Number.isFinite(m.value);
  const s = scoreCheck(target, m);
  return {
    id,
    keyframe: key.keyframe,
    phase: key.keyframe,
    check: key.check,
    part: def.part,
    name: def.name,
    label: def.name,
    unit: def.unit,
    value: measured ? m!.value : null,
    note: measured ? null : (m?.note ?? "not measured"),
    scored: s.scored,
    score: s.score,
    direction: s.direction,
    magnitude: s.magnitude,
    passMin: s.passMin,
    passMax: s.passMax,
    phrase: s.direction ? def[s.direction] : null,
    frame: m?.frame ?? null,
  };
}

/**
 * The shot's scorecard. `enabled` = the feedback filter's check ids (null /
 * omitted = every check).
 */
export function scoreShotKeyframes(
  shot: Pick<ShotKeyframes, "checks">,
  targets: KeyframeTargets,
  enabled?: ReadonlySet<string> | null,
): KeyframeScorecard {
  const ids = ALL_CHECK_KEYS.filter((id) => !enabled || enabled.has(id));
  const checks = ids
    .map((id) => scoreOne(id, shot, targets))
    .filter((r): r is CheckResult => r !== null);
  const keyframes = KEYFRAMES.map((k) => {
    const cs = checks.filter((c) => c.keyframe === k);
    return {
      keyframe: k,
      name: KEYFRAME_NAME[k],
      score: mean(cs.filter((c) => c.score !== null).map((c) => c.score!)),
      checks: cs,
    };
  });
  const scored = checks.filter((c) => c.scored);
  const measuredFraction = scored.length
    ? scored.filter((c) => c.score !== null).length / scored.length
    : 0;
  const belowCoverageGate = measuredFraction < COVERAGE_GATE;
  const kfScores = keyframes
    .filter((k) => k.score !== null)
    .map((k) => k.score!);
  return {
    overall: belowCoverageGate ? null : mean(kfScores),
    keyframes,
    checks,
    worst: checks
      .filter((c) => c.score !== null && c.score > 0)
      .sort((a, b) => b.score! - a.score!),
    measuredFraction,
    belowCoverageGate,
  };
}

// ---- display ----------------------------------------------------------------

export type Severity = "good" | "warn" | "bad";
/** On the shown whole numbers: 0 green · 1–3 yellow · 4+ red. */
export function severity(score: number | null): Severity | null {
  if (score === null) return null;
  const w = wholeScore(score);
  if (w <= 0) return "good";
  if (w <= 3) return "warn";
  return "bad";
}

/** "Knees too bent by 5" · "Knee bend: in range" · "Knee bend: not measured". */
export function checkText(r: CheckResult): string {
  if (r.value === null || r.score === null) return `${r.name}: not measured`;
  if (!r.phrase || r.score === 0) return `${r.name}: in range`;
  return `${r.phrase} by ${displayScore(r.score)}`;
}

/** The headline for a shot: "Rise: Knees too bent by 5" (null: nothing off). */
export function headlineIssue(card: KeyframeScorecard): string | null {
  const w = card.worst[0];
  return w ? `${KEYFRAME_NAME[w.keyframe]}: ${checkText(w)}` : null;
}

// ---- feedback ---------------------------------------------------------------

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * What's fed back after a shot: the worst `max` enabled checks, at most one
 * per body part, in the order the shot happens.
 */
export function feedbackChecks(
  card: KeyframeScorecard,
  max = FEEDBACK_COUNT,
): CheckResult[] {
  const used = new Set<BodyPart>();
  const pick: CheckResult[] = [];
  for (const r of card.worst) {
    if (used.has(r.part)) continue;
    used.add(r.part);
    pick.push(r);
    if (pick.length === max) break;
  }
  const order = (r: CheckResult) =>
    KEYFRAMES.indexOf(r.keyframe) * 100 + BODY_PARTS.indexOf(r.part);
  return pick.sort((a, b) => order(a) - order(b));
}

/**
 * The spoken readback: the same words as the screen, checks from one keyframe
 * under one lead-in — "When the ball reaches set point: knees too bent by 5,
 * hands too low by 3. At release: hands too low by 1." ("" = nothing to say).
 */
export function spokenReadback(items: readonly CheckResult[]): string {
  const groups: { keyframe: Keyframe; parts: string[] }[] = [];
  for (const r of items) {
    if (!r.phrase || r.score === null) continue;
    const text = lowerFirst(`${r.phrase} by ${displayScore(r.score)}`);
    const last = groups.at(-1);
    if (last && last.keyframe === r.keyframe) last.parts.push(text);
    else groups.push({ keyframe: r.keyframe, parts: [text] });
  }
  return groups
    .map((g) => `${KEYFRAME_LEAD_IN[g.keyframe]}: ${g.parts.join(", ")}.`)
    .join(" ");
}
