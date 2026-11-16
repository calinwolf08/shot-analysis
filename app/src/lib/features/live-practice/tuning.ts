/**
 * Live-practice tuning: the hand-editable knobs for positioning cues and the
 * readiness gate, loaded from `static/config/live-tuning.json` at loop boot so
 * they can be tweaked while testing (edit the file, reload the page).
 *
 * Every key is optional in the file; missing keys use the defaults below and
 * invalid values are dropped with a warning, so a typo never breaks the loop.
 *
 * @see docs/practice-loop-fixes-plan.md §3.1
 */
import { z } from "zod";

export interface CueTuning {
  /** A cue must be the current cue this long before it is spoken. */
  readonly holdMs: number;
  /** Silence after any spoken cue before another cue may be spoken. */
  readonly cooldownMs: number;
  /** Minimum gap before the same cue is repeated. */
  readonly repeatSameMs: number;
  /** Positioned must hold this long before "Ready" (bypasses the cooldown). */
  readonly readyHoldMs: number;
}

export interface ReadinessTuning {
  /** Visibility needed on the near-side shoulder/hip/knee/ankle. */
  readonly nearSideMinVis: number;
  /** Visibility needed on the head (nose or near ear). */
  readonly headMinVis: number;
  /** Full body must hold this long (frame time). */
  readonly fullBodyHoldMs: number;
  /** Shoulder/hip x-spread ÷ torso height at or below which a frame is side-on. */
  readonly maxSideSeparation: number;
  /** Recent frames voted on for orientation. */
  readonly orientationWindow: number;
  /** Fraction of voted frames that must agree on the required side. */
  readonly minOrientationAgreement: number;
}

export interface LatencyTuning {
  /** "auto": full model, falling back to lite when too slow. */
  readonly model: "auto" | "full" | "lite";
  /** Switch to lite when the median capture→pose latency exceeds this. */
  readonly liteFallbackP50Ms: number;
  /** Latency samples per decision window. */
  readonly windowFrames: number;
  /** First samples ignored (model warm-up). */
  readonly warmupFrames: number;
}

export interface LiveTuning {
  readonly cues: CueTuning;
  readonly readiness: ReadinessTuning;
  readonly latency: LatencyTuning;
}

export const DEFAULT_LIVE_TUNING: LiveTuning = {
  cues: {
    holdMs: 1500,
    cooldownMs: 5000,
    repeatSameMs: 10000,
    readyHoldMs: 1000,
  },
  readiness: {
    nearSideMinVis: 0.5,
    headMinVis: 0.5,
    fullBodyHoldMs: 1000,
    maxSideSeparation: 0.5,
    orientationWindow: 30,
    minOrientationAgreement: 0.6,
  },
  latency: {
    model: "auto",
    liteFallbackP50Ms: 150,
    windowFrames: 30,
    warmupFrames: 15,
  },
};

const ms = z.number().finite().min(0).max(120_000);
const frac = z.number().finite().min(0).max(1);

/** Per-key validators (a bad key is dropped, the rest still apply). */
const FIELD_SCHEMAS = {
  cues: {
    holdMs: ms,
    cooldownMs: ms,
    repeatSameMs: ms,
    readyHoldMs: ms,
  },
  readiness: {
    nearSideMinVis: frac,
    headMinVis: frac,
    fullBodyHoldMs: ms,
    maxSideSeparation: z.number().finite().min(0).max(5),
    orientationWindow: z.number().int().min(3).max(300),
    minOrientationAgreement: frac,
  },
  latency: {
    model: z.enum(["auto", "full", "lite"]),
    liteFallbackP50Ms: ms,
    windowFrames: z.number().int().min(3).max(300),
    warmupFrames: z.number().int().min(0).max(1000),
  },
} as const;

const SECTIONS = ["cues", "readiness", "latency"] as const;

export interface TuningResult {
  readonly tuning: LiveTuning;
  /** Human-readable problems found in the file (empty when clean). */
  readonly warnings: string[];
}

/**
 * Pure: merges a raw (parsed JSON) tuning object over the defaults, key by
 * key. Unknown keys and `$comment` entries are ignored; invalid values are
 * reported and replaced by the default.
 */
export function mergeTuning(raw: unknown): TuningResult {
  const warnings: string[] = [];
  const out: Record<(typeof SECTIONS)[number], Record<string, unknown>> = {
    cues: { ...DEFAULT_LIVE_TUNING.cues },
    readiness: { ...DEFAULT_LIVE_TUNING.readiness },
    latency: { ...DEFAULT_LIVE_TUNING.latency },
  };

  if (raw === null || typeof raw !== "object") {
    if (raw !== undefined) warnings.push("tuning file is not an object");
    return { tuning: out as unknown as LiveTuning, warnings };
  }

  for (const section of SECTIONS) {
    const given = (raw as Record<string, unknown>)[section];
    if (given === undefined) continue;
    if (given === null || typeof given !== "object") {
      warnings.push(`${section}: expected an object`);
      continue;
    }
    const fields = FIELD_SCHEMAS[section] as Record<string, z.ZodTypeAny>;
    for (const [key, value] of Object.entries(given)) {
      if (key.startsWith("$")) continue;
      const schema = fields[key];
      if (!schema) {
        warnings.push(`${section}.${key}: unknown key (ignored)`);
        continue;
      }
      const parsed = schema.safeParse(value);
      if (parsed.success) out[section][key] = parsed.data;
      else
        warnings.push(
          `${section}.${key}: invalid value ${JSON.stringify(value)}`,
        );
    }
  }
  return { tuning: out as unknown as LiveTuning, warnings };
}

export const LIVE_TUNING_URL = "/config/live-tuning.json";

/**
 * Fetches and merges the tuning file. Never throws: a missing or broken file
 * yields the defaults plus a warning.
 */
export async function loadLiveTuning(
  fetchImpl: typeof fetch = fetch,
  url: string = LIVE_TUNING_URL,
): Promise<TuningResult> {
  try {
    const res = await fetchImpl(url, { cache: "no-store" });
    if (!res.ok) {
      return {
        tuning: DEFAULT_LIVE_TUNING,
        warnings: [`tuning file HTTP ${res.status}; using defaults`],
      };
    }
    return mergeTuning(await res.json());
  } catch (err) {
    return {
      tuning: DEFAULT_LIVE_TUNING,
      warnings: [`tuning file unreadable (${String(err)}); using defaults`],
    };
  }
}
