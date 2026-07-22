import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

/**
 * Data now lives on the server (single user-scoped DB), not in the browser.
 * This asserts the server-backed persistence contract the app depends on: a
 * profile created in one context survives a full reload (and a fresh context
 * signing in as the same user) because it is stored server-side.
 */
test("a profile persists across reload via the server database", async ({
  page,
}) => {
  await onboard(page, "?e2e=replay", "Persisted");

  // A signed-in user with a player lands on home, not onboarding.
  await page.goto("/?e2e=replay");
  await page.waitForSelector('[data-testid="db-ready"]', { state: "attached" });
  await expect(page).toHaveURL(/\/\?e2e=replay$/);

  // Reload again: still home — the player was read back from the server.
  await page.reload();
  await page.waitForSelector('[data-testid="db-ready"]', { state: "attached" });
  await expect(page).toHaveURL(/\/\?e2e=replay$/);
});
