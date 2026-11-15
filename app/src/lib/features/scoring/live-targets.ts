/**
 * Loads the live deviation targets asset (`live-targets.json`) in the browser.
 *
 * Mirrors `scoring/v2/service.ts loadThresholds`: the targets ship as a static
 * asset and are fetched + cached per module. The server reads the same file
 * from disk instead (see `$lib/server/live-targets`), avoiding a self-fetch.
 *
 * @see docs/live-redesign-plan.md §3.1–3.2
 */
import type { LiveTargets } from "./deviation";

let cached: LiveTargets | null = null;

export async function loadLiveTargets(
  fetchFn: typeof fetch = fetch,
): Promise<LiveTargets> {
  if (cached) return cached;
  const res = await fetchFn("/reference/live-targets.json");
  if (!res.ok) {
    throw new Error(`live-targets.json not available (${res.status})`);
  }
  cached = (await res.json()) as LiveTargets;
  return cached;
}

/** Test seam: drop the cache so a test can load a different asset. */
export function resetLiveTargetsCache(): void {
  cached = null;
}
