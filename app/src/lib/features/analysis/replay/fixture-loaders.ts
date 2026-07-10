import type { FixtureLoader } from "./replay-analysis-service";

/**
 * Browser fixture loader: fetches `${baseUrl}/${id}.json`.
 * Fixtures are copied into the served build for e2e runs only
 * (see playwright.config.ts webServer command).
 */
export function createFetchFixtureLoader(
  baseUrl = "/fixtures/poses",
): FixtureLoader {
  return async (fixtureId: string) => {
    const res = await fetch(`${baseUrl}/${fixtureId}.json`);
    if (!res.ok) {
      throw new Error(
        `Failed to load fixture ${fixtureId}: HTTP ${res.status}`,
      );
    }
    return res.json();
  };
}
