/**
 * Shared golden-file builder for the v2 metrics regression harness.
 *
 * Used by both the regeneration script (build-metrics-golden.ts) and the test
 * (metrics-golden.test.ts) so they extract identically.
 */

import * as fs from "fs";
import * as path from "path";
import { extractShotMetrics, flattenMetrics } from "../metrics/v2";
import type { PoseData } from "./types";

export const GOLDEN_PATH = path.join(
  process.cwd(),
  "src",
  "testing",
  "__fixtures__",
  "metrics-golden.json",
);

/** clip name -> shot key ("s<start>") -> metric id -> rounded value. */
export type MetricsGolden = Record<string, Record<string, Record<string, number>>>;

const round = (x: number): number => Math.round(x * 1e4) / 1e4;

/**
 * Extracts reliable v2 metrics for every labeled test-data clip. Camera
 * orientation comes from the first labeled shot; shooting hand defaults to
 * right (the golden only needs to be internally consistent, not "correct").
 */
export function buildMetricsGolden(dataDir = "test-data"): MetricsGolden {
  const out: MetricsGolden = {};
  for (const clip of fs.readdirSync(dataDir).sort()) {
    const dir = path.join(dataDir, clip);
    const posesPath = path.join(dir, "poses.json");
    const labelsPath = path.join(dir, "labels.json");
    if (!fs.existsSync(posesPath) || !fs.existsSync(labelsPath)) continue;
    const poses = JSON.parse(fs.readFileSync(posesPath, "utf8")) as PoseData;
    const labels = JSON.parse(fs.readFileSync(labelsPath, "utf8"));
    const orientation: string | undefined = labels.shots?.[0]?.cameraOrientation;

    const shots = extractShotMetrics(poses, {
      shootingHand: "right",
      ...(orientation ? { cameraOrientation: orientation } : {}),
    });
    if (shots.length === 0) continue;

    const clipOut: Record<string, Record<string, number>> = {};
    for (const shot of shots) {
      const row: Record<string, number> = {};
      for (const m of flattenMetrics(shot)) {
        if (m.reliable && Number.isFinite(m.value)) row[m.id] = round(m.value);
      }
      clipOut[`s${shot.shot.startFrame}`] = row;
    }
    out[clip] = clipOut;
  }
  return out;
}
