import { expect, test } from "./fixtures";
import { onboard, screenPath } from "./helpers";

/**
 * Debug tools index, reached the way a person would: Profile → "Debug
 * tools". (The Profile link and these pages are absent from production
 * builds — enforced by scripts/check-debug-stripped.mjs.)
 */
test("Profile → Debug tools lists every tool", async ({ page }) => {
  await onboard(page, "?e2e=replay", "Auditor");

  await page.getByTestId("tab-profile").click();
  await page.getByTestId("debug-tools-link").click();
  await expect(page.getByTestId("debug-index")).toBeVisible();
  for (const tool of ["replay", "scorecard", "analyze", "drills"]) {
    await expect(page.getByTestId(`debug-link-${tool}`)).toBeVisible();
  }
  await expect(page.getByTestId("debug-link-reference")).toHaveCount(0);
  await page.screenshot({ path: screenPath("debug", "debug-index") });
});
