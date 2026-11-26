import { expect, test } from "./fixtures";
import { onboard } from "./helpers";

/**
 * Pro profiles (docs/pro-targets-plan.md Phase 5): "Score against" stays
 * hidden until pro targets exist for the keyframe checks
 * (docs/keyframe-review-plan.md) — even when a pro build is served.
 */

const PROFILES = {
  version: 1,
  builtAt: "2026-01-01T00:00:00Z",
  metricsSchema: 4,
  pros: [
    {
      id: "curry",
      name: "Stephen Curry",
      shootingHand: "right",
      shots: 20,
      angles: [2, 18],
      metrics: { "load.knee_depth": { value: 130, spread: 3, n: 20 } },
    },
  ],
};

test("no 'Score against' setting, even with pros served", async ({ page }) => {
  await page.route("**/reference/pro-profiles.json", (r) =>
    r.fulfill({ json: PROFILES }),
  );
  await onboard(page, "?e2e=replay", "NoPros");
  await page.getByTestId("tab-profile").click();
  await expect(page.getByTestId("voice-toggle")).toBeVisible();
  await expect(page.getByTestId("score-against")).toHaveCount(0);
});
