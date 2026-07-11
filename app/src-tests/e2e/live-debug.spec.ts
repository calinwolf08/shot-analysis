/**
 * The live-detection debug HUD (`?debug=live`, available in dev/e2e builds
 * only) surfaces coordinator diagnostics over the practice loop. Driven by
 * the replay backend: the HUD must show live state + velocity numbers and
 * log rep events as the fixture loops.
 */
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 240_000 });

const QUERY = "?e2e=replay&debug=live";

async function onboard(page: Page) {
  await page.goto(`/${QUERY}`);
  await page.waitForURL("**/onboarding**");
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-name").fill("Debugger");
  await page.getByTestId("onboarding-to-camera").click();
  await page.getByTestId("onboarding-finish").click();
  await page.waitForURL(/\/\?e2e=replay&debug=live$/);
}

test("debug HUD shows coordinator state and logs rep events", async ({
  page,
}) => {
  await onboard(page);
  await page.goto(`/practice/live${QUERY}`);

  await expect(page.getByTestId("setup-start")).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId("setup-start").click();
  await expect(page.getByTestId("practice-loop")).toBeVisible({
    timeout: 30_000,
  });

  // HUD is mounted and streaming per-frame diagnostics.
  await expect(page.getByTestId("live-debug-hud")).toBeVisible();
  await expect(page.getByTestId("live-debug-state")).not.toHaveText("—", {
    timeout: 30_000,
  });

  // A replayed rep completes → the event log records the detection.
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId("live-debug-log")).toContainText(
    "shot detected",
  );
});

test("HUD stays hidden without the debug flag", async ({ page }) => {
  await onboard(page);
  await page.goto(`/practice/live${QUERY.replace("&debug=live", "")}`);
  await expect(page.getByTestId("setup-start")).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId("setup-start").click();
  await expect(page.getByTestId("practice-loop")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("live-debug-hud")).toHaveCount(0);
});
