/**
 * Feedback filter: which keyframe checks the player wants feedback on, shared
 * by shot review and live practice (`feedbackChecks` setting). Turned-off
 * checks are left out of the scores, the worst list, the screen and the voice.
 *
 * Presets ("Focus areas") turn on a common set in one tap; "Pick checks"
 * toggles single check × keyframe pairs.
 *
 * Pure (plus `loadEnabledChecks`, which only reads settings).
 */
import {
  ALL_CHECK_KEYS,
  KEYFRAMES,
  checkKey,
  parseCheckKey,
  type CheckId,
  type Keyframe,
} from "basketball-shot-analysis";
import type { SettingsRepo } from "$lib/shared/db/repos";

/**
 * The old live focus areas (one per v3 phase, plus rhythm), kept only to read
 * a selection saved before the feedback filter; older ids map onto them.
 */
const LEGACY_AREAS = ["load", "rise", "set-point", "release", "rhythm"];
const LEGACY_AREA_IDS: Readonly<Record<string, string>> = {
  "base-balance": "load",
  "load-depth": "load",
  elbow: "set-point",
  head: "set-point",
  "follow-through": "release",
};
function normalizeAreas(ids: readonly string[]): string[] {
  const set = new Set(ids.map((id) => LEGACY_AREA_IDS[id] ?? id));
  return LEGACY_AREAS.filter((a) => set.has(a));
}

export interface FeedbackPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly checks: readonly string[];
}

function pick(
  checks: readonly CheckId[],
  keyframes: readonly Keyframe[],
): string[] {
  return ALL_CHECK_KEYS.filter((id) => {
    const k = parseCheckKey(id)!;
    return checks.includes(k.check) && keyframes.includes(k.keyframe);
  });
}

const LEGS: readonly Keyframe[] = ["load", "rise", "setPoint", "release"];

export const FEEDBACK_PRESETS: readonly FeedbackPreset[] = [
  {
    id: "all",
    name: "All feedback",
    description: "Every check at every phase.",
    checks: ALL_CHECK_KEYS,
  },
  {
    id: "legs",
    name: "Leg drive",
    description:
      "Knees and hips from Load to Release: are your legs done by the time the ball reaches set point?",
    checks: pick(["knee_bend", "hips_over_knees"], LEGS),
  },
  {
    id: "set-point",
    name: "Set point",
    description:
      "Hands, wrist and elbow as the ball arrives at set point, and how long you hold it.",
    checks: pick(
      ["hand_height", "wrist_hinge", "elbow_bend", "hold"],
      ["rise", "setPoint"],
    ),
  },
  {
    id: "dip",
    name: "Dip & load",
    description:
      "Where the ball goes and how you sit into the shot at Setup and Load.",
    checks: pick(
      ["hand_height", "ball_close", "knee_bend", "back"],
      ["setup", "load"],
    ),
  },
  {
    id: "release",
    name: "Release",
    description: "Hands, wrist and elbow at the release, plus staying tall.",
    checks: pick(
      ["hand_height", "wrist_hinge", "elbow_bend", "back"],
      ["release"],
    ),
  },
  {
    id: "posture",
    name: "Posture",
    description: "Back and hips through the whole shot.",
    checks: pick(["back", "hips_over_knees"], KEYFRAMES),
  },
];

/** Known check ids only, in catalog order, duplicates merged. */
export function normalizeChecks(ids: readonly string[]): string[] {
  const set = new Set(ids);
  return ALL_CHECK_KEYS.filter((id) => set.has(id));
}

/** The preset the selection matches exactly, or null ("Custom"). */
export function activePreset(
  enabled: ReadonlySet<string> | null,
): FeedbackPreset | null {
  const on = enabled ?? new Set(ALL_CHECK_KEYS);
  return (
    FEEDBACK_PRESETS.find(
      (p) => p.checks.length === on.size && p.checks.every((id) => on.has(id)),
    ) ?? null
  );
}

/** Pill / chip label for the selection: a preset name, else "Custom". */
export function filterLabel(enabled: ReadonlySet<string> | null): string {
  return activePreset(enabled)?.name ?? "Custom";
}

/**
 * Legacy focus areas (one per v3 phase, plus rhythm) → the checks at those
 * keyframes. Rhythm (timing) becomes the hold at set point.
 */
const AREA_KEYFRAMES: Readonly<Record<string, readonly Keyframe[]>> = {
  load: ["setup", "load"],
  rise: ["rise"],
  "set-point": ["setPoint"],
  release: ["release"],
};

export function checksForAreas(areaIds: readonly string[]): string[] {
  const out = new Set<string>();
  for (const a of normalizeAreas(areaIds)) {
    if (a === "rhythm") out.add(checkKey("setPoint", "hold"));
    for (const k of AREA_KEYFRAMES[a] ?? []) {
      for (const id of ALL_CHECK_KEYS)
        if (parseCheckKey(id)!.keyframe === k) out.add(id);
    }
  }
  return normalizeChecks([...out]);
}

/**
 * The enabled checks from the stored settings: the saved filter, else the
 * legacy focus areas mapped onto checks, else null (every check).
 */
export function resolveEnabled(
  feedbackChecks: readonly string[] | null,
  legacyAreas: readonly string[] = [],
): ReadonlySet<string> | null {
  if (feedbackChecks) return new Set(normalizeChecks(feedbackChecks));
  const mapped = checksForAreas(legacyAreas);
  return mapped.length > 0 ? new Set(mapped) : null;
}

export async function loadEnabledChecks(
  settings: Pick<SettingsRepo, "get">,
): Promise<ReadonlySet<string> | null> {
  const [checks, areas] = await Promise.all([
    settings.get("feedbackChecks").catch(() => null),
    settings.get("liveFocusAreas").catch(() => [] as string[]),
  ]);
  return resolveEnabled(checks, areas);
}

/** Saves the selection (every check is stored as the full list). */
export async function saveEnabledChecks(
  settings: Pick<SettingsRepo, "set">,
  enabled: ReadonlySet<string>,
): Promise<void> {
  await settings.set("feedbackChecks", normalizeChecks([...enabled]));
}
