/**
 * v2 scoring service (metrics overhaul Step 9).
 *
 * Loads the reference thresholds and scores a shot's poses against them,
 * producing the Sequencing / Structure scorecard the UI renders. Thresholds
 * ship as a static asset (app/static/reference/thresholds.json — placeholder
 * until real NBA-derived thresholds land; the format is identical).
 */

import {
  extractShotMetrics,
  scoreShot,
  type PoseData,
  type ShotScore,
  type Thresholds,
} from "basketball-shot-analysis";

let cached: Thresholds | null = null;

/** Loads (and caches) the reference thresholds asset. */
export async function loadThresholds(
  fetchFn: typeof fetch = fetch,
): Promise<Thresholds> {
  if (cached) return cached;
  const res = await fetchFn("/reference/thresholds.json");
  if (!res.ok) throw new Error(`thresholds.json not available (${res.status})`);
  cached = (await res.json()) as Thresholds;
  return cached;
}

export interface ScoreShotsOptions {
  readonly shootingHand?: "left" | "right";
  readonly cameraOrientation?: string;
}

/** Extracts v2 metrics for every shot in the poses and scores each. */
export function scoreShots(
  poseData: PoseData,
  thresholds: Thresholds,
  opts: ScoreShotsOptions = {},
): ShotScore[] {
  const metrics = extractShotMetrics(poseData, {
    shootingHand: opts.shootingHand ?? "right",
    ...(opts.cameraOrientation
      ? { cameraOrientation: opts.cameraOrientation }
      : {}),
  });
  return metrics.map((m) => scoreShot(m, thresholds));
}
