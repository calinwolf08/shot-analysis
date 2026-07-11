/**
 * Authentication flows against the real auth server: guard redirects,
 * sign-up validation + account creation, session persistence, and
 * sign-in with wrong/right credentials from a clean browser context.
 */
import { expect, test } from "@playwright/test";
import { E2E_PASSWORD, onboard, signUp, uniqueEmail } from "./helpers";

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

test("forgot → emailed link → reset → sign in with the new password", async ({
  page,
  browser,
}) => {
  const email = await signUp(page, "?e2e=replay", "reset");

  // From a signed-out context, request the reset link.
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto("/auth/forgot-password?e2e=replay");
  await fresh.getByTestId("auth-email").fill(email);
  await fresh.getByTestId("auth-submit").click();
  await expect(fresh.getByTestId("auth-forgot-sent")).toBeVisible();

  // The auth server's e2e endpoint stands in for the mailbox.
  const lookup = await fresh.request.get(
    `http://localhost:5174/__test/reset-url?email=${encodeURIComponent(email)}`,
  );
  const { url } = (await lookup.json()) as { url: string | null };
  expect(url).toBeTruthy();

  // Following the emailed link redirects to the app reset page with a token.
  const follow = await fresh.request.get(url!, { maxRedirects: 0 });
  expect(follow.status()).toBe(302);
  const appLink = follow.headers()["location"]!;
  expect(appLink).toContain("/auth/reset-password");

  const newPassword = "brand-new-pass-1";
  await fresh.goto(appLink);
  await fresh.getByTestId("auth-password").fill(newPassword);
  await fresh.getByTestId("auth-confirm").fill(newPassword);
  await fresh.getByTestId("auth-submit").click();
  await expect(fresh.getByTestId("auth-reset-done")).toBeVisible();

  // Old password no longer works; the new one signs in.
  await fresh.getByTestId("auth-to-sign-in").click();
  await fresh.getByTestId("auth-email").fill(email);
  await fresh.getByTestId("auth-password").fill(E2E_PASSWORD);
  await fresh.getByTestId("auth-submit").click();
  await expect(fresh.getByTestId("auth-error")).toBeVisible();
  await fresh.getByTestId("auth-password").fill(newPassword);
  await fresh.getByTestId("auth-submit").click();
  await fresh.waitForURL("**/onboarding**");
  await context.close();
});

test("change password from profile, sign out, sign back in", async ({
  page,
}) => {
  const email = await onboard(page, "?e2e=replay", "Changer");

  await page.getByTestId("tab-profile").click();
  await expect(page.getByTestId("account-email")).toHaveText(email);

  // Wrong current password is rejected.
  await page.getByTestId("account-change-password").click();
  await page.getByTestId("account-current-password").fill("not-my-password");
  await page.getByTestId("account-new-password").fill("next-password-22");
  await page.getByTestId("account-confirm-password").fill("next-password-22");
  await page.getByTestId("account-change-submit").click();
  await expect(page.getByTestId("account-change-error")).toBeVisible();

  // Correct current password succeeds.
  await page.getByTestId("account-current-password").fill(E2E_PASSWORD);
  await page.getByTestId("account-change-submit").click();
  await expect(page.getByTestId("account-change-done")).toBeVisible();

  // Sign out → guard sends us to sign-in.
  await page.getByTestId("account-sign-out").click();
  await page.waitForURL("**/auth/sign-in**");

  // Sign back in with the new password; profile is already onboarded →
  // straight to home.
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill("next-password-22");
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((url) => url.pathname === "/");
});

test("two accounts on one device keep separate player profiles", async ({
  page,
}) => {
  // Account A onboards.
  const emailA = await onboard(page, "?e2e=replay", "UserA");
  await page.getByTestId("tab-profile").click();
  await expect(page.getByTestId("profile-name")).toHaveText("UserA");

  // Sign out; account B signs up in the SAME browser profile (same local
  // DB) and must onboard its own player rather than seeing A's.
  await page.getByTestId("account-sign-out").click();
  await page.waitForURL("**/auth/sign-in**");
  await signUp(page, "?e2e=replay", "userb");
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-name").fill("UserB");
  await page.getByTestId("onboarding-to-camera").click();
  await page.getByTestId("onboarding-finish").click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.getByTestId("tab-profile").click();
  await expect(page.getByTestId("profile-name")).toHaveText("UserB");

  // Back to A: their player is intact.
  await page.getByTestId("account-sign-out").click();
  await page.waitForURL("**/auth/sign-in**");
  await page.getByTestId("auth-email").fill(emailA);
  await page.getByTestId("auth-password").fill(E2E_PASSWORD);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.getByTestId("tab-profile").click();
  await expect(page.getByTestId("profile-name")).toHaveText("UserA");
});
