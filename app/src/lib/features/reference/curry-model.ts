/**
 * The reference ("model") shots the live targets are built from — today
 * Stephen Curry's 7 labeled side-on shots — measured EXACTLY the way
 * `src/testing/build-live-targets.ts` measures them (same frame conversion,
 * detected keyframes per labeled window, same pose-confidence mean, same
 * reliability filter). The Curry viewer shows these per-shot values next to
 * the target band so the targets can be audited.
 *
 * Pure; the caller supplies the parsed poses/labels JSON.
 */
import {
  detectKeyframesFromFrames,
  flattenMetrics,
  keyframeFramesFromPoseData,
  metricsForShot,
  type PoseData,
} from "basketball-shot-analysis";

export interface ReferenceLabels {
  readonly video?: string;
  readonly shots: readonly {
    readonly shotNumber?: number;
    readonly startFrame: number;
    readonly endFrame: number;
    readonly cameraOrientation?: string;
    /** Human-labeled keyframes (frame indexes), when present. */
    readonly [keyframe: string]: unknown;
  }[];
}

export interface ReferenceMetricValue {
  readonly value: number;
  /** Frames the value was measured at (first = where to seek). */
  readonly frames: readonly number[];
}

export interface ReferenceShot {
  readonly number: number;
  readonly startFrame: number;
  readonly endFrame: number;
  readonly orientation: string;
  /** Detected keyframes (null = not detected). */
  readonly keyframes: Readonly<Record<string, number | null>>;
  /** Reliable, finite metric values by id; absent = unmeasured. */
  readonly metrics: ReadonlyMap<string, ReferenceMetricValue>;
}

export function computeReferenceShots(
  poses: PoseData,
  labels: ReferenceLabels,
  shootingHand: "left" | "right" = "right",
): ReferenceShot[] {
  const fps = poses.fps ?? 30;
  const kfFrames = keyframeFramesFromPoseData(poses);
  return labels.shots.map((lab, i) => {
    const start = lab.startFrame;
    const end = lab.endFrame;
    const kf = detectKeyframesFromFrames(kfFrames, start, end);
    let sum = 0;
    let n = 0;
    for (let f = start; f <= end && f < poses.frames.length; f++) {
      const c = poses.frames[f]?.poseConfidence;
      if (typeof c === "number") {
        sum += c;
        n++;
      }
    }
    const orientation = lab.cameraOrientation ?? "side-left";
    const v2 = metricsForShot(
      kfFrames,
      kf,
      { startFrame: start, endFrame: end },
      {
        fps,
        cameraOrientation: orientation,
        shootingHand,
        poseConfidence: n > 0 ? sum / n : 0,
      },
    );
    const metrics = new Map<string, ReferenceMetricValue>();
    for (const m of flattenMetrics(v2)) {
      if (!m.reliable || !Number.isFinite(m.value)) continue;
      metrics.set(m.id, { value: m.value, frames: m.frames });
    }
    return {
      number: lab.shotNumber ?? i + 1,
      startFrame: start,
      endFrame: end,
      orientation,
      keyframes: Object.fromEntries(kf),
      metrics,
    };
  });
}

// ---- table model -------------------------------------------------------------

export interface TargetEntry {
  readonly label: string;
  readonly phase: string | null;
  readonly section: string;
  readonly unit: string;
  readonly ideal: number;
  readonly sd: number;
  readonly passMin: number;
  readonly passMax: number;
  readonly scored: boolean;
}

export interface MetricRow {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  readonly unit: string;
  readonly scored: boolean;
  /** One cell per reference shot (null = unmeasured). */
  readonly cells: readonly (ReferenceMetricValue | null)[];
  readonly ideal: number;
  readonly sd: number;
  readonly passMin: number;
  readonly passMax: number;
  /** Per cell: more than 2 SD from the target mean. */
  readonly outlier: readonly boolean[];
}

export interface MetricGroup {
  readonly group: string;
  readonly rows: readonly MetricRow[];
}

const GROUP_ORDER = [
  "gather",
  "load",
  "rise",
  "setPoint",
  "release",
  "followThrough",
  "sequencing",
];

/** Rows (one per target metric) grouped by phase, then sequencing. */
export function buildMetricTable(
  shots: readonly ReferenceShot[],
  targets: Readonly<Record<string, TargetEntry>>,
): MetricGroup[] {
  const groups = new Map<string, MetricRow[]>();
  for (const [id, t] of Object.entries(targets)) {
    const group = t.phase ?? "sequencing";
    const cells = shots.map((s) => s.metrics.get(id) ?? null);
    const row: MetricRow = {
      id,
      label: t.label,
      group,
      unit: t.unit,
      scored: t.scored,
      cells,
      ideal: t.ideal,
      sd: t.sd,
      passMin: t.passMin,
      passMax: t.passMax,
      outlier: cells.map(
        (c) => c !== null && t.sd > 0 && Math.abs(c.value - t.ideal) > 2 * t.sd,
      ),
    };
    groups.set(group, [...(groups.get(group) ?? []), row]);
  }
  return [...groups.entries()]
    .sort(
      ([a], [b]) =>
        (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99),
    )
    .map(([group, rows]) => ({
      group,
      rows: [...rows].sort((a, b) => a.id.localeCompare(b.id)),
    }));
}
