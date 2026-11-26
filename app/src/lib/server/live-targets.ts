/**
 * Server-side loader for the v3 live targets.
 *
 * Reads the same `static/reference/live-targets-v3.json` the browser fetches,
 * but from disk — the server has no origin to self-fetch against. Cached per
 * process. `LIVE_TARGETS_V3_PATH` overrides the location for deployments whose
 * static assets don't sit under the working directory.
 *
 * Server-only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { KeyframeTargets, LiveTargetsV3 } from "basketball-shot-analysis";

let cachedV3: LiveTargetsV3 | null = null;

/** The v3 live targets (static/reference/live-targets-v3.json). */
export function readLiveTargetsV3(): LiveTargetsV3 {
  if (cachedV3) return cachedV3;
  const path =
    process.env.LIVE_TARGETS_V3_PATH ??
    join(process.cwd(), "static", "reference", "live-targets-v3.json");
  cachedV3 = JSON.parse(readFileSync(path, "utf8")) as LiveTargetsV3;
  return cachedV3;
}

let cachedKeyframes: KeyframeTargets | null = null;

/**
 * The keyframe targets (static/reference/live-targets-keyframes.json);
 * `LIVE_TARGETS_KEYFRAMES_PATH` overrides the location.
 */
export function readKeyframeTargets(): KeyframeTargets {
  if (cachedKeyframes) return cachedKeyframes;
  const path =
    process.env.LIVE_TARGETS_KEYFRAMES_PATH ??
    join(process.cwd(), "static", "reference", "live-targets-keyframes.json");
  cachedKeyframes = JSON.parse(readFileSync(path, "utf8")) as KeyframeTargets;
  return cachedKeyframes;
}

/** Test seam: drop the cache. */
export function resetLiveTargetsCacheServer(): void {
  cachedV3 = null;
  cachedKeyframes = null;
}
