import { expect, test } from "./fixtures";
import { onboard, startLiveLoop } from "./helpers";

/**
 * Pro profiles (docs/pro-targets-plan.md Phase 5): hidden until a pro build
 * exists; then Profile → "Score against" picks a pro, the choice is saved per
 * user, and scoring still works against that pro's targets.
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

test("no pro build: no 'Score against' setting", async ({ page }) => {
  // The shipped file until the first pro build: no pros.
  await page.route("**/reference/pro-profiles.json", (r) =>
    r.fulfill({ json: { ...PROFILES, pros: [] } }),
  );
  await onboard(page, "?e2e=replay", "NoPros");
  await page.getByTestId("tab-profile").click();
  await expect(page.getByTestId("voice-toggle")).toBeVisible();
  await expect(page.getByTestId("score-against")).toHaveCount(0);
});

test("score against a pro: saved, and shots still score", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/reference/pro-profiles.json", (r) =>
    r.fulfill({ json: PROFILES }),
  );
  await onboard(page, "?e2e=replay", "ProFan");
  await page.getByTestId("tab-profile").click();
  const select = page.getByTestId("score-against");
  await expect(select).toBeVisible();
  await select.selectOption("curry");
  await page.reload();
  await expect(page.getByTestId("score-against")).toHaveValue("curry");

  // Practice + review score against Curry's targets.
  await page.getByTestId("tab-practice").click();
  await startLiveLoop(page);
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 60_000,
  });
  await page.getByTestId("tab-shots").click();
  await page.locator('[data-testid^="shot-row-"]').first().click();
  await expect(page.getByTestId("scorecard-v3")).toBeVisible();
  await expect(page.getByTestId("v3-row-load.knee_depth")).toBeVisible();
});
