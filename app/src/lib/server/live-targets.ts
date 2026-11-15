/**
 * Server-side loader for the live deviation targets.
 *
 * Reads the same `static/reference/live-targets.json` the browser fetches, but
 * from disk — the server has no origin to self-fetch against. Cached per
 * process. `LIVE_TARGETS_PATH` overrides the location for deployments whose
 * static assets don't sit under the working directory.
 *
 * Server-only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LiveTargets } from "$lib/features/scoring";

let cached: LiveTargets | null = null;

export function readLiveTargets(): LiveTargets {
  if (cached) return cached;
  const path =
    process.env.LIVE_TARGETS_PATH ??
    join(process.cwd(), "static", "reference", "live-targets.json");
  cached = JSON.parse(readFileSync(path, "utf8")) as LiveTargets;
  return cached;
}

/** Test seam: drop the cache. */
export function resetLiveTargetsCacheServer(): void {
  cached = null;
}
