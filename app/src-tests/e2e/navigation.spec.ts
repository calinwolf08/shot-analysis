/**
 * Tier A — real-user navigation across the app's pages via actual clicks, with
 * the shared console-error guard (from ./fixtures) active on every test. Fills
 * the gaps the flow-specific specs don't cover: tab-bar navigation between all
 * four tabs, the profile page + sign-out, and the forgot-password round trip.
 */
import { test, expect } from "./fixtures";
import { onboard } from "./helpers";

test("navigates every tab via the tab bar", async ({ page }) => {
  await onboard(page);

  // Practice is the entry tab.
  await expect(page.getByTestId("tab-practice")).toBeVisible();
  await expect(page.getByTestId("practice-live")).toBeVisible();

  await page.getByTestId("tab-shots").click();
  await page.waitForURL("**/shots**");
  // Fresh profile → no shots yet.
  await expect(page.getByTestId("empty-state")).toBeVisible();

  await page.getByTestId("tab-insights").click();
  await page.waitForURL("**/insights**");
  await expect(page.getByTestId("insights")).toBeVisible();

  await page.getByTestId("tab-profile").click();
  await page.waitForURL("**/profile**");
  await expect(page.getByTestId("profile-name")).toBeVisible();

  // ...and back to Practice.
  await page.getByTestId("tab-practice").click();
  await page.waitForURL("**/practice**");
  await expect(page.getByTestId("practice-live")).toBeVisible();
});

test("profile shows the player and signs out", async ({ page }) => {
  await onboard(page, "?e2e=replay", "Casey");

  await page.getByTestId("tab-profile").click();
  await page.waitForURL("**/profile**");

  await expect(page.getByTestId("profile-name")).toHaveText("Casey");
  await expect(page.getByTestId("profile-hand")).toBeVisible();
  await expect(page.getByTestId("profile-level")).toBeVisible();

  await page.getByTestId("account-sign-out").click();
  // Signed-out users are guarded back to sign-in.
  await page.waitForURL("**/auth/sign-in**");
  await expect(page.getByTestId("auth-sign-in")).toBeVisible();
});

test("forgot-password round trip from sign-in", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await expect(page.getByTestId("auth-sign-in")).toBeVisible();

  await page.getByTestId("auth-to-forgot").click();
  await page.waitForURL("**/auth/forgot-password**");

  await page.getByTestId("auth-email").fill("someone@e2e.local");
  await page.getByTestId("auth-submit").click();
  // The app always confirms (no account enumeration), reset link is logged.
  await expect(page.getByTestId("auth-forgot-sent")).toBeVisible();

  await page.getByTestId("auth-to-sign-in").click();
  await page.waitForURL("**/auth/sign-in**");
  await expect(page.getByTestId("auth-sign-in")).toBeVisible();
});

test("sign-up link is reachable from sign-in", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await page.getByTestId("auth-to-sign-up").click();
  await page.waitForURL("**/auth/sign-up**");
  await expect(page.getByTestId("auth-email")).toBeVisible();
});
