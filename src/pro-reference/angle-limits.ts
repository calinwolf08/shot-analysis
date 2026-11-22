/**
 * How far off side-on (degrees) a clip may be for each metric to count
 * toward targets (docs/pro-targets-plan.md, Phase 3 table). In-plane metrics
 * survive the 1/cos correction well; arm / head metrics move sideways or get
 * occluded, so they need a squarer view; the guide hand is never measured
 * from a side clip. Phase 4 re-tunes these from data.
 */
import { geometryKindForLimit } from "./metric-kinds";

export const DEFAULT_LIMITS = {
  /** Knees, hips, centre-line torso, offsets, heights. */
  inPlane: 25,
  /** Event timing (barely affected by the camera angle). */
  timing: 25,
  /** Elbow, wrist, elbow path, head pitch, ball close. */
  arm: 15,
  /** Guide hand: never from side clips. */
  never: 0,
} as const;

export type LimitClass = keyof typeof DEFAULT_LIMITS;

/** Per-metric overrides (id → max degrees). */
export type AngleLimitOverrides = Readonly<Record<string, number>>;

export function limitClass(id: string): LimitClass {
  return geometryKindForLimit(id);
}

/** Max camera angle (deg off side-on) at which `id` is measured. */
export function angleLimit(
  id: string,
  overrides: AngleLimitOverrides = {},
): number {
  return overrides[id] ?? DEFAULT_LIMITS[limitClass(id)];
}

/** Whether `id` counts at `angle` degrees off side-on. */
export function withinAngleLimit(
  id: string,
  angle: number,
  overrides: AngleLimitOverrides = {},
): boolean {
  return Math.abs(angle) <= angleLimit(id, overrides);
}
