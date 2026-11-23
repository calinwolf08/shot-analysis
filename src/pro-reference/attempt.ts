/**
 * Measuring one reference shot attempt the way the target build will (and
 * the review tool shows): from the person's labelled key frames when there
 * are any, with the confirmed camera angle corrected for — plus the same
 * attempt measured from the app's own detection, to compare.
 *
 * Pure; shared by the review page (browser) and the target build (node).
 */
import {
  EVENT_PAD_AFTER,
  EVENT_PAD_BEFORE,
  LABEL_FOR_EVENT,
  computeShotMetricsV3,
  effectiveBand,
  estimateCameraAngle,
  labeledEventFrames,
  scoreValue,
  type CameraAngleEstimate,
  type LiveTargetsV3,
  type SegmentLengths,
  type ShotMetricsV3,
  type SignalFrame,
} from "../metrics/v3";
import { angleLimit } from "./angle-limits";
import { KEYFRAMES, type AttemptLabel } from "./labels";

export interface PoseFile {
  readonly width: number;
  readonly height: number;
  readonly fps?: number;
  readonly frames: readonly SignalFrame[];
}

export interface MeasureOptions {
  readonly shootingHand: "left" | "right";
  /** The shooter's frontal widths (proportions), for the angle estimate. */
  readonly frontal?: { shoulders: number; hips: number };
  /**
   * True limb lengths ÷ torso (side-on calibration): knee and elbow angles
   * are then measured per segment in 3D.
   */
  readonly segmentLengths?: SegmentLengths;
}

/** Frames of an attempt's window, padded for event search. */
export function attemptWindow(
  poses: PoseFile,
  shot: Pick<AttemptLabel, "startFrame" | "endFrame">,
): SignalFrame[] {
  const lo = shot.startFrame - EVENT_PAD_BEFORE;
  const hi = shot.endFrame + EVENT_PAD_AFTER;
  return poses.frames.filter((f) => f.frameIndex >= lo && f.frameIndex <= hi);
}

export interface AttemptMeasurement {
  /** What the app would read: detected events, no correction. */
  readonly app: ShotMetricsV3;
  /** Labelled events (when any) + camera correction: the value used. */
  readonly primary: ShotMetricsV3;
  /** Labelled events, no correction (shows what the correction did). */
  readonly uncorrected: ShotMetricsV3;
  /** Detected events + camera correction (labels vs detection). */
  readonly fromDetection: ShotMetricsV3;
  /**
   * Like `primary` but without the per-segment 3D knee / elbow angles
   * (null when no limb lengths were given) — shows what that changed.
   */
  readonly planar: ShotMetricsV3 | null;
  /** Body-based estimate over the dip → set point. */
  readonly autoCamera: CameraAngleEstimate | null;
  /** The camera angle applied: confirmed/adjusted label, else the estimate. */
  readonly angle: number;
  /** Whether labelled key frames were used. */
  readonly usedLabels: boolean;
  /** Share of window frames without a pose. */
  readonly missingPoseShare: number;
}

/**
 * Frames for the camera-angle estimate: the dip's start → the set point
 * (labelled, else detected), when the shooter is squared to the basket and
 * most metrics are measured. Frames before the dip are unreliable — the
 * player is often still turning into the shot (Curry: 10–33° there vs a
 * steady 33–43° through load → set point). Falls back to the shot window.
 */
function angleFrames(
  win: readonly SignalFrame[],
  shot: AttemptLabel,
  app: ShotMetricsV3,
): SignalFrame[] {
  const from =
    shot.keyframes["legs_start_bending"] ??
    app.events.hipDropStart ??
    app.events.ballDropStart ??
    shot.startFrame;
  const to =
    shot.keyframes["set_point"] ?? app.events.setPoint ?? shot.endFrame;
  const pick = win.filter((f) => f.frameIndex >= from && f.frameIndex <= to);
  return pick.length >= 5
    ? pick
    : win.filter(
        (f) => f.frameIndex >= shot.startFrame && f.frameIndex <= shot.endFrame,
      );
}

export function measureAttempt(
  poses: PoseFile,
  shot: AttemptLabel,
  o: MeasureOptions,
): AttemptMeasurement {
  const win = attemptWindow(poses, shot);
  const base = {
    aspect: poses.width / poses.height,
    shootingHand: o.shootingHand,
  };
  const app = computeShotMetricsV3(win, base);
  const autoCamera = estimateCameraAngle(angleFrames(win, shot, app), {
    aspect: base.aspect,
    ...(o.frontal ? { frontal: o.frontal } : {}),
  });
  const angle = shot.camera?.angle ?? autoCamera?.angle ?? 0;
  const labelled = labeledEventFrames({
    startFrame: shot.startFrame,
    keyframes: shot.keyframes,
  });
  const usedLabels = Object.keys(labelled).length > 0;
  const events = usedLabels ? { events: labelled } : {};
  const segs = o.segmentLengths ? { segmentLengths: o.segmentLengths } : {};
  const planar = computeShotMetricsV3(win, {
    ...base,
    ...events,
    cameraAngle: angle,
  });
  return {
    app,
    primary: o.segmentLengths
      ? computeShotMetricsV3(win, {
          ...base,
          ...events,
          ...segs,
          cameraAngle: angle,
        })
      : planar,
    planar: o.segmentLengths ? planar : null,
    uncorrected: computeShotMetricsV3(win, { ...base, ...events }),
    fromDetection: computeShotMetricsV3(win, { ...base, cameraAngle: angle }),
    autoCamera,
    angle,
    usedLabels,
    missingPoseShare:
      win.length === 0
        ? 1
        : win.filter((f) => !f.landmarks).length / win.length,
  };
}

// ---- key frames: labels vs detection ---------------------------------------

/** Detected within this many frames of the label counts as agreeing. */
export const KEYFRAME_TOLERANCE = 2;

export interface KeyframeCheck {
  readonly key: string;
  readonly name: string;
  readonly label: number | null;
  /** The app's detected frame (null: not detected / no matching event). */
  readonly detected: number | null;
  readonly diff: number | null;
  readonly status: "ok" | "off" | "missing" | "unlabelled";
}

export function keyframeChecks(
  shot: AttemptLabel,
  app: ShotMetricsV3,
): KeyframeCheck[] {
  const eventFor = new Map(LABEL_FOR_EVENT.map(([e, k]) => [k, e]));
  return KEYFRAMES.map(({ key, name }) => {
    const label = shot.keyframes[key] ?? null;
    const ev = eventFor.get(key);
    const d = ev ? app.events[ev] : null;
    const detected = d === null || d === undefined ? null : Math.round(d);
    const diff = label !== null && detected !== null ? detected - label : null;
    const status: KeyframeCheck["status"] =
      label === null
        ? "unlabelled"
        : detected === null
          ? ev
            ? "missing"
            : "unlabelled"
          : Math.abs(diff!) <= KEYFRAME_TOLERANCE
            ? "ok"
            : "off";
    return { key, name, label, detected, diff, status };
  });
}

// ---- metric rows ------------------------------------------------------------

export interface MetricRow {
  readonly id: string;
  readonly phase: string;
  readonly label: string;
  readonly unit: string;
  readonly scored: boolean;
  /** The value used (labelled events + correction); null = not measured. */
  readonly value: number | null;
  readonly uncorrected: number | null;
  readonly fromDetection: number | null;
  /** Without per-segment 3D (null when not used or unchanged). */
  readonly planar: number | null;
  readonly frames: readonly number[];
  readonly score: number | null;
  readonly direction: "low" | "high" | null;
  readonly passMin: number;
  readonly passMax: number;
  readonly note: string | null;
  /** Max camera angle for this metric, and whether this attempt exceeds it. */
  readonly angleLimit: number;
  readonly overAngleLimit: boolean;
  /** The reviewer's flag note (left out of targets), if any. */
  readonly flag: string | null;
}

const valueOf = (m: ShotMetricsV3, id: string): number | null => {
  const x = m.metrics[id];
  return x && x.reliable && Number.isFinite(x.value) ? x.value : null;
};

/** Every target metric for the attempt, in the targets' order. */
export function metricRows(
  m: AttemptMeasurement,
  shot: AttemptLabel,
  targets: LiveTargetsV3,
  limits: Readonly<Record<string, number>> = {},
): MetricRow[] {
  return Object.entries(targets.metrics).map(([id, t]) => {
    const value = valueOf(m.primary, id);
    const s = value === null ? null : scoreValue(t, value);
    const band = effectiveBand(t);
    const limit = angleLimit(id, limits);
    return {
      id,
      phase: t.phase,
      label: t.label,
      unit: t.unit,
      scored: band.scored,
      value,
      uncorrected: valueOf(m.uncorrected, id),
      fromDetection: valueOf(m.fromDetection, id),
      planar: m.planar ? valueOf(m.planar, id) : null,
      frames: m.primary.metrics[id]?.frames ?? [],
      score: s?.score ?? null,
      direction: s?.direction ?? null,
      passMin: band.passMin,
      passMax: band.passMax,
      note: m.primary.metrics[id]?.note ?? null,
      angleLimit: limit,
      overAngleLimit: Math.abs(m.angle) > limit,
      flag: shot.metricFlags[id] ?? null,
    };
  });
}

// ---- outliers within a player ------------------------------------------------

/** Robust z beyond which a value is far from the player's other shots. */
export const OUTLIER_Z = 2.5;

/**
 * Per attempt, the metric ids whose value is far from the same player's
 * other attempts (median ± OUTLIER_Z robust SDs; needs ≥ 4 values).
 */
export function playerOutliers(
  values: Readonly<Record<string, Readonly<Record<string, number | null>>>>,
): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const k of Object.keys(values)) out[k] = new Set();
  const ids = new Set(Object.values(values).flatMap((v) => Object.keys(v)));
  for (const id of ids) {
    const xs = Object.entries(values)
      .map(([k, v]) => [k, v[id]] as const)
      .filter((e): e is readonly [string, number] => typeof e[1] === "number");
    if (xs.length < 4) continue;
    const med = median(xs.map((e) => e[1]));
    const sd = 1.4826 * median(xs.map((e) => Math.abs(e[1] - med)));
    if (!(sd > 0)) continue;
    for (const [k, v] of xs) {
      if (Math.abs(v - med) / sd > OUTLIER_Z) out[k]!.add(id);
    }
  }
  return out;
}

function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

// ---- automatic flags ----------------------------------------------------------

export interface AutoFlag {
  readonly kind:
    | "standing-open"
    | "over-angle-limit"
    | "keyframe-off"
    | "outlier"
    | "low-tracking"
    | "no-angle";
  readonly text: string;
}

/** Things for the reviewer to look at (never applied silently). */
export function autoFlags(
  m: AttemptMeasurement,
  rows: readonly MetricRow[],
  checks: readonly KeyframeCheck[],
  outliers: ReadonlySet<string> = new Set(),
): AutoFlag[] {
  const flags: AutoFlag[] = [];
  if (!m.autoCamera) {
    flags.push({
      kind: "no-angle",
      text: "Camera angle couldn't be estimated",
    });
  } else if (m.autoCamera.standingOpen) {
    flags.push({
      kind: "standing-open",
      text: `Shoulders ${m.autoCamera.shoulders.toFixed(0)}° vs hips ${m.autoCamera.hips.toFixed(0)}°: standing open or rotating`,
    });
  }
  const over = rows.filter((r) => r.overAngleLimit && r.value !== null);
  if (over.length > 0) {
    flags.push({
      kind: "over-angle-limit",
      text: `${over.length} metric(s) beyond their angle limit at ${m.angle.toFixed(0)}° (left out of targets)`,
    });
  }
  const off = checks.filter(
    (c) => c.status === "off" || c.status === "missing",
  );
  if (off.length > 0) {
    flags.push({
      kind: "keyframe-off",
      text: `Detection disagrees with ${off.length} labelled key frame(s): ${off.map((c) => c.name).join(", ")}`,
    });
  }
  if (outliers.size > 0) {
    flags.push({
      kind: "outlier",
      text: `${outliers.size} value(s) far from this player's other shots`,
    });
  }
  if (m.missingPoseShare > 0.2) {
    flags.push({
      kind: "low-tracking",
      text: `No pose on ${Math.round(m.missingPoseShare * 100)}% of the shot's frames`,
    });
  }
  return flags;
}
