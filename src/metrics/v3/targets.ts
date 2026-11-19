/**
 * Live targets for the v3 catalog (`app/static/reference/live-targets-v3.json`),
 * built from reference shots: per metric the mean (`ideal`), the observed band
 * (`passMin`..`passMax` — a reference value is by definition on target), and a
 * spread (`rampSd`) that sets how fast the score climbs outside the band.
 *
 * Hand edits survive rebuilds: an existing file's `label`, `wording` and
 * `override` (band / scored) are carried over; only the statistics refresh.
 *
 * Pure.
 */
import type { MetricKind, MetricPhase, MetricUnit, ShotMetricsV3 } from "./metrics";
import { wordingFor, type MetricWording } from "./wording";

export const LIVE_TARGETS_V3_VERSION = 2 as const;
/** A metric needs this many reference values to be scored. */
export const MIN_REFERENCE_VALUES = 3;

export interface TargetOverride {
  readonly passMin?: number;
  readonly passMax?: number;
  readonly scored?: boolean;
}

export interface TargetV3 {
  readonly phase: MetricPhase;
  readonly kind: MetricKind;
  readonly unit: MetricUnit;
  readonly label: string;
  readonly wording: Pick<MetricWording, "low" | "high">;
  readonly scored: boolean;
  readonly ideal: number;
  readonly sd: number;
  readonly passMin: number;
  readonly passMax: number;
  readonly rampSd: number;
  /** Reference values the stats came from. */
  readonly n: number;
  /** Some reference values were measured over too few frames (timing). */
  readonly lowResolution: boolean;
  /** Hand-set band / scored flag; wins over the computed values. */
  readonly override?: TargetOverride;
}

export interface LiveTargetsV3 {
  readonly version: typeof LIVE_TARGETS_V3_VERSION;
  readonly catalog: "v3";
  readonly builtFrom: string;
  readonly shootingHand: "left" | "right";
  readonly shots: number;
  readonly generatedAt: string;
  readonly notes: readonly string[];
  readonly metrics: Readonly<Record<string, TargetV3>>;
}

/** The band actually used for scoring (override wins). */
export function effectiveBand(t: TargetV3): {
  passMin: number;
  passMax: number;
  scored: boolean;
} {
  return {
    passMin: t.override?.passMin ?? t.passMin,
    passMax: t.override?.passMax ?? t.passMax,
    scored: t.override?.scored ?? t.scored,
  };
}

function rampScale(sd: number, range: number, ideal: number): number {
  if (sd > 0) return sd;
  if (range > 0) return range / 4;
  return Math.max(1e-6, Math.abs(ideal) * 0.05);
}

export function buildTargetsV3(
  shots: readonly ShotMetricsV3[],
  meta: { builtFrom: string; shootingHand: "left" | "right"; generatedAt?: string },
  previous?: Pick<LiveTargetsV3, "metrics"> | null,
): LiveTargetsV3 {
  const ids = new Set(shots.flatMap((s) => Object.keys(s.metrics)));
  const metrics: Record<string, TargetV3> = {};
  for (const id of [...ids].sort()) {
    const first = shots.find((s) => s.metrics[id])!.metrics[id]!;
    const ms = shots.map((s) => s.metrics[id]).filter((m) => m && m.reliable);
    const vals = ms.map((m) => m!.value);
    const n = vals.length;
    const ideal = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
    const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - ideal) ** 2, 0) / (n - 1)) : 0;
    const lo = n ? Math.min(...vals) : 0;
    const hi = n ? Math.max(...vals) : 0;
    const prev = previous?.metrics[id];
    const def = wordingFor(id);
    metrics[id] = {
      phase: first.phase,
      kind: first.kind,
      unit: first.unit,
      label: prev?.label ?? def.label,
      wording: prev?.wording ?? { low: def.low, high: def.high },
      scored: first.kind !== "detail" && n >= MIN_REFERENCE_VALUES,
      ideal,
      sd,
      passMin: lo,
      passMax: hi,
      rampSd: rampScale(sd, hi - lo, ideal),
      n,
      lowResolution: ms.some((m) => m!.note === "low resolution"),
      ...(prev?.override ? { override: prev.override } : {}),
    };
  }
  return {
    version: LIVE_TARGETS_V3_VERSION,
    catalog: "v3",
    builtFrom: meta.builtFrom,
    shootingHand: meta.shootingHand,
    shots: shots.length,
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    notes: [
      "Band = the reference shots' observed range: inside it scores 0.",
      "Outside, the score climbs 1 point per rampSd (the reference spread). Display caps at 10+.",
      "Hand-edit label / wording / override freely; rebuilds keep them.",
      "Timing metrics marked lowResolution came from phases only a few frames long — their bands are loose.",
    ],
    metrics,
  };
}
