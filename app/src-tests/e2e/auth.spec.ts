/**
 * Authentication flows against the real auth server: guard redirects,
 * sign-up validation + account creation, session persistence, and
 * sign-in with wrong/right credentials from a clean browser context.
 */
import { expect, test } from "@playwright/test";
import { E2E_PASSWORD, signUp, uniqueEmail } from "./helpers";

test("unauthenticated visits are redirected to sign-in", async ({ page }) => {
  await page.goto("/?e2e=replay");
  await page.waitForURL("**/auth/sign-in**");
  await expect(page.getByTestId("auth-sign-in")).toBeVisible();

  // Deep links are guarded too.
  await page.goto("/plan/anything?e2e=replay");
  await page.waitForURL("**/auth/sign-in**");
});

test("sign-up validates locally, creates the account, and persists the session", async ({
  page,
}) => {
  await page.goto("/auth/sign-up?e2e=replay");
  const email = uniqueEmail("valid");
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(E2E_PASSWORD);
  await page.getByTestId("auth-confirm").fill("something-else-9");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toContainText(
    "Passwords don't match",
  );

  await page.getByTestId("auth-confirm").fill(E2E_PASSWORD);
  await page.getByTestId("auth-submit").click();
  // Signed in with no player → onboarding.
  await page.waitForURL("**/onboarding**");

  // The session survives a reload (cookie-based).
  await page.reload();
  await page.waitForSelector('[data-testid="db-ready"]', {
    state: "attached",
  });
  await expect(page).not.toHaveURL(/auth\/sign-in/);
});

test("sign-in rejects a wrong password and accepts the right one", async ({
  page,
  browser,
}) => {
  const email = await signUp(page, "?e2e=replay", "signin");

  // A clean context (no cookies, fresh local DB) has to authenticate.
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto("/auth/sign-in?e2e=replay");
  await fresh.getByTestId("auth-email").fill(email);
  await fresh.getByTestId("auth-password").fill("totally-wrong-1");
  await fresh.getByTestId("auth-submit").click();
  await expect(fresh.getByTestId("auth-error")).toBeVisible();
  await expect(fresh).toHaveURL(/auth\/sign-in/);

  await fresh.getByTestId("auth-password").fill(E2E_PASSWORD);
  await fresh.getByTestId("auth-submit").click();
  // Same account, new device: signed in; local profile is fresh → onboarding.
  await fresh.waitForURL("**/onboarding**");
  await context.close();
});
