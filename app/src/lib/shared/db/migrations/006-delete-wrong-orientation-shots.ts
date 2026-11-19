import type { Migration } from "./types";

/**
 * One-time cleanup (practice-loop fixes — Phase 3): delete every stored shot
 * whose camera orientation isn't the one live practice now accepts — side-on
 * with the SHOOTING arm nearest the camera: "side-right" for right-handed
 * players, "side-left" for left-handed. Shots with no or "unknown"
 * orientation go too. Applies to ALL shots (live and the hidden
 * upload/assessment path), per the product decision.
 *
 * Irreversible. Dependents are removed (shot_poses, shot_metrics, shot-scoped
 * scores) or unlinked (reps.shot_id is nullable; the rep row is kept) before
 * the shots themselves, so foreign keys hold.
 *
 * On-device video clips keyed by these shot ids are not reachable from the
 * server; the clip store's own cap evicts them.
 */
const DOOMED = `SELECT s.id FROM shots s JOIN players p ON p.id = s.player_id
  WHERE s.orientation IS NULL
     OR s.orientation <> (CASE p.shooting_hand WHEN 'left' THEN 'side-left' ELSE 'side-right' END)`;

export const deleteWrongOrientationShots: Migration = {
  version: 6,
  name: "delete-wrong-orientation-shots",
  up: [
    `DELETE FROM shot_poses WHERE shot_id IN (${DOOMED})`,
    `DELETE FROM shot_metrics WHERE shot_id IN (${DOOMED})`,
    `DELETE FROM scores WHERE scope = 'shot' AND ref_id IN (${DOOMED})`,
    `UPDATE reps SET shot_id = NULL WHERE shot_id IN (${DOOMED})`,
    `DELETE FROM shots WHERE id IN (${DOOMED})`,
  ],
};
