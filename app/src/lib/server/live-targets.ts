/**
 * Server-side loader for the keyframe targets.
 *
 * Reads the same `static/reference/live-targets-keyframes.json` the browser
 * fetches, but from disk — the server has no origin to self-fetch against.
 * Cached per process. `LIVE_TARGETS_KEYFRAMES_PATH` overrides the location for
 * deployments whose static assets don't sit under the working directory.
 *
 * Server-only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { KeyframeTargets } from "basketball-shot-analysis";

let cachedKeyframes: KeyframeTargets | null = null;

/** The keyframe targets (static/reference/live-targets-keyframes.json). */
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
  cachedKeyframes = null;
}
