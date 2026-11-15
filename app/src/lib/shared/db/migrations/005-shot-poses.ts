import type { Migration } from "./types";

/**
 * Per-shot review poses (live redesign — step 7).
 *
 * Stores a compact, analysis-aligned 2D skeleton track for each shot so the
 * Shots review screen can scrub and draw the pose at any frame with keyframe
 * and metric overlays — server-side, available for every shot and every device
 * (the skeleton fallback). Raw clip VIDEO (last-N, on-device) is a separate,
 * later enhancement; pose data lives here for all shots.
 *
 * Kept out of the `shots` row (which the Shots/Insights lists scan) so list
 * reads stay light. Scoped via shot → player; no separate user_id.
 */
export const shotPoses: Migration = {
  version: 5,
  name: "shot-poses",
  up: [
    `CREATE TABLE shot_poses (
      shot_id TEXT PRIMARY KEY REFERENCES shots(id),
      poses_json TEXT NOT NULL
    )`,
  ],
};
