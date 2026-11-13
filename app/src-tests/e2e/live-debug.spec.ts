/**
 * The live-detection debug HUD (`?debug=live`, available in dev/e2e builds
 * only) surfaces coordinator diagnostics over the practice loop. Driven by
 * the replay backend: the HUD must show live state + velocity numbers and
 * log rep events as the fixture loops.
 */
import { expect, test, type Page } from "@playwright/test";
import { onboard as freshUser, startLiveLoop } from "./helpers";

test.describe.configure({ timeout: 240_000 });

const QUERY = "?e2e=replay&debug=live";

async function onboard(page: Page) {
  await freshUser(page, QUERY, "Debugger");
}

test("debug HUD shows coordinator state and logs rep events", async ({
  page,
}) => {
  await onboard(page);
  await page.goto(`/practice/live${QUERY}`);
  await startLiveLoop(page);

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
  await startLiveLoop(page);
  await expect(page.getByTestId("live-debug-hud")).toHaveCount(0);
});
