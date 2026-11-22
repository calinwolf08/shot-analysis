/** Which angle-limit class each v3 metric falls in (see angle-limits.ts). */
import type { LimitClass } from "./angle-limits";

const ARM = new Set([
  "load.elbow_angle",
  "load.elbow_change",
  "load.ball_close",
  "load.head_pitch",
  "rise.elbow_change_1",
  "rise.elbow_change_2",
  "rise.wrist_hinge_change_1",
  "rise.wrist_hinge_change_2",
  "rise.head_pitch_change",
  "setPoint.elbow_angle",
  "setPoint.head_pitch",
  "release.elbow_path",
  "release.wrist_snap",
  "detail.wrist_path_deviation",
  "detail.elbow_height_vs_head",
  "detail.follow_through_elbow_max",
]);
const NEVER = new Set(["release.guide_hand_dx", "release.guide_hand_dy"]);

export function geometryKindForLimit(id: string): LimitClass {
  if (NEVER.has(id)) return "never";
  if (ARM.has(id)) return "arm";
  if (/\.t_/.test(id) || id === "detail.release_vs_takeoff") return "timing";
  return "inPlane";
}
