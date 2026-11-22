/**
 * Reference (pro) clip labels — `reference-data/players/<player>/<clip>/
 * labels.json`, format v2 (docs/pro-targets-plan.md): per shot attempt its
 * window, the person's key frames, the confirmed camera angle, the review
 * decision and per-metric flags.
 *
 * v1 files (key frames at the shot's top level, as in test-data/) are read as
 * v2 with `status: "unreviewed"`. Pure.
 */

export const LABELS_VERSION = 2 as const;

/** Key frames in shot order, with display names (as in the validator). */
export const KEYFRAMES: readonly { key: string; name: string }[] = [
  { key: "legs_start_bending", name: "Legs bend start" },
  { key: "leg_bend_low_point", name: "Leg low point" },
  { key: "ball_low_point", name: "Ball low point" },
  { key: "legs_start_extending", name: "Legs extend" },
  { key: "ball_starts_upward", name: "Ball up" },
  { key: "set_point", name: "Set point" },
  { key: "legs_fully_extended", name: "Legs full ext" },
  { key: "release", name: "Release" },
  { key: "arms_fully_extended", name: "Arms extended" },
  { key: "feet_leave_ground", name: "Feet leave" },
  { key: "feet_land", name: "Feet land" },
];
const KEYFRAME_KEYS = new Set(KEYFRAMES.map((k) => k.key));

export type AttemptStatus = "unreviewed" | "approved" | "excluded" | "flagged";
export const ATTEMPT_STATUSES: readonly AttemptStatus[] = [
  "unreviewed",
  "approved",
  "flagged",
  "excluded",
];

export interface CameraLabel {
  /** Degrees off side-on from the body estimate (null: not measurable). */
  readonly autoAngle: number | null;
  readonly autoDetail?: {
    readonly shoulders: number;
    readonly hips: number;
    readonly frames: readonly number[];
  };
  /** The angle used (auto or adjusted). */
  readonly angle: number;
  readonly source: "auto" | "manual" | "scenery";
  readonly confirmed: boolean;
  readonly standingOpen: boolean;
}

export interface AttemptLabel {
  readonly shotNumber: number;
  readonly startFrame: number;
  readonly endFrame: number;
  readonly cameraOrientation?: string;
  /** Labelled key frames (source frame indexes). */
  readonly keyframes: Readonly<Record<string, number>>;
  readonly camera: CameraLabel | null;
  readonly status: AttemptStatus;
  readonly excludeReason: string | null;
  /** Metric id → note: leave this metric out for this attempt. */
  readonly metricFlags: Readonly<Record<string, string>>;
  readonly notes: string;
}

export interface ClipLabels {
  readonly version: typeof LABELS_VERSION;
  readonly video: string;
  readonly labeledBy: string;
  readonly labeledAt: string;
  readonly shots: readonly AttemptLabel[];
}

const STATUS = new Set<string>(ATTEMPT_STATUSES);
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

function upgradeAttempt(raw: Record<string, unknown>, i: number): AttemptLabel {
  const keyframes: Record<string, number> = {};
  const fromV2 = raw.keyframes;
  if (fromV2 && typeof fromV2 === "object") {
    for (const [k, v] of Object.entries(fromV2 as Record<string, unknown>)) {
      const n = num(v);
      if (n !== null) keyframes[k] = n;
    }
  }
  // v1: key frames at the top level (any known key, plus range ends).
  for (const [k, v] of Object.entries(raw)) {
    const n = num(v);
    if (n !== null && (KEYFRAME_KEYS.has(k) || k.endsWith("_end"))) {
      keyframes[k] ??= n;
    }
  }
  const cam = raw.camera as Record<string, unknown> | null | undefined;
  const camera: CameraLabel | null =
    cam && typeof cam === "object" && num(cam.angle) !== null
      ? {
          autoAngle: num(cam.autoAngle),
          ...(cam.autoDetail && typeof cam.autoDetail === "object"
            ? {
                autoDetail: cam.autoDetail as CameraLabel["autoDetail"] &
                  object,
              }
            : {}),
          angle: num(cam.angle)!,
          source:
            cam.source === "manual" || cam.source === "scenery"
              ? cam.source
              : "auto",
          confirmed: cam.confirmed === true,
          standingOpen: cam.standingOpen === true,
        }
      : null;
  const flags: Record<string, string> = {};
  if (raw.metricFlags && typeof raw.metricFlags === "object") {
    for (const [k, v] of Object.entries(raw.metricFlags as object)) {
      flags[k] = str(v);
    }
  }
  return {
    shotNumber: num(raw.shotNumber) ?? i + 1,
    startFrame: num(raw.startFrame) ?? 0,
    endFrame: num(raw.endFrame) ?? 0,
    ...(typeof raw.cameraOrientation === "string"
      ? { cameraOrientation: raw.cameraOrientation }
      : {}),
    keyframes,
    camera,
    status: STATUS.has(str(raw.status))
      ? (raw.status as AttemptStatus)
      : "unreviewed",
    excludeReason:
      typeof raw.excludeReason === "string" ? raw.excludeReason : null,
    metricFlags: flags,
    notes: str(raw.notes),
  };
}

/** Any labels.json (v1 or v2) → v2. */
export function upgradeLabels(raw: unknown, video = ""): ClipLabels {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const shots = Array.isArray(r.shots) ? r.shots : [];
  return {
    version: LABELS_VERSION,
    video: str(r.video, video),
    labeledBy: str(r.labeledBy, "human"),
    labeledAt: str(r.labeledAt, ""),
    shots: shots
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map(upgradeAttempt)
      .sort((a, b) => a.startFrame - b.startFrame)
      .map((s, i) => ({ ...s, shotNumber: i + 1 })),
  };
}

/** A new attempt for a window (e.g. a detected shot). */
export function newAttempt(
  startFrame: number,
  endFrame: number,
  shotNumber = 0,
): AttemptLabel {
  return {
    shotNumber,
    startFrame,
    endFrame,
    keyframes: {},
    camera: null,
    status: "unreviewed",
    excludeReason: null,
    metricFlags: {},
    notes: "",
  };
}

/** Status counts over attempts. */
export function statusCounts(
  shots: readonly Pick<AttemptLabel, "status">[],
): Record<AttemptStatus, number> {
  const c: Record<AttemptStatus, number> = {
    unreviewed: 0,
    approved: 0,
    flagged: 0,
    excluded: 0,
  };
  for (const s of shots) c[s.status]++;
  return c;
}
