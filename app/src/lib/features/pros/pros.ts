/**
 * Pro profiles in the app (`static/reference/pro-profiles.json`, built by
 * `npm run targets:build:pros`). Absent until the first build — everything
 * then degrades to "no pros".
 *
 * Scoring against a pro and "closest pros" were built on the v3 metrics and
 * were removed with them; they come back on the keyframe checks once pro
 * targets exist (docs/keyframe-review-plan.md).
 */
import type { ProProfiles } from "basketball-shot-analysis";

export const PRO_PROFILES_URL = "/reference/pro-profiles.json";

let cache: Promise<ProProfiles | null> | null = null;

/** The pro profiles, or null when none have been built. */
export function loadProProfiles(
  fetchImpl: typeof fetch = fetch,
): Promise<ProProfiles | null> {
  cache ??= fetchImpl(PRO_PROFILES_URL)
    .then(async (r) => {
      if (!r.ok) return null;
      const j = (await r.json()) as ProProfiles;
      return Array.isArray(j?.pros) && j.pros.length > 0 ? j : null;
    })
    .catch(() => null);
  return cache;
}

export function resetProProfilesCache(): void {
  cache = null;
}
