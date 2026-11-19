/** Loads (and caches) the v3 live targets served from static/reference. */
import type { LiveTargetsV3 } from "basketball-shot-analysis";

let cache: Promise<LiveTargetsV3> | null = null;

export function loadLiveTargetsV3(
  fetchImpl: typeof fetch = fetch,
): Promise<LiveTargetsV3> {
  cache ??= fetchImpl("/reference/live-targets-v3.json").then((r) => {
    if (!r.ok) throw new Error(`live-targets-v3.json: HTTP ${r.status}`);
    return r.json() as Promise<LiveTargetsV3>;
  });
  return cache;
}

export function resetLiveTargetsV3Cache(): void {
  cache = null;
}
