/**
 * Shared e2e flows. Every spec runs against the real backend (the single
 * SvelteKit adapter-node server boots from playwright.config.ts and serves
 * both the app and /api/*), so a fresh browser context must create an account
 * before it can reach the app — `onboard` does sign-up + onboarding in one go.
 */
import { type Page } from "@playwright/test";

export const E2E_PASSWORD = "e2e-password-1";

let counter = 0;
/** Unique per run+call so repeated runs against one auth DB never collide. */
export function uniqueEmail(tag: string): string {
  counter += 1;
  return `${tag}-${Date.now()}-${process.pid}-${counter}@e2e.local`;
}

/** Creates a fresh account; the guard then lands us on onboarding. */
export async function signUp(
  page: Page,
  query: string,
  tag = "user",
): Promise<string> {
  const email = uniqueEmail(tag);
  await page.goto(`/auth/sign-up${query}`);
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(E2E_PASSWORD);
  await page.getByTestId("auth-confirm").fill(E2E_PASSWORD);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("**/onboarding**");
  return email;
}

/** Fresh profile end to end: sign-up → onboarding → Practice (the entry tab). */
export async function onboard(
  page: Page,
  query = "?e2e=replay",
  name = "Player",
): Promise<string> {
  const email = await signUp(page, query, name.toLowerCase());
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-name").fill(name);
  await page.getByTestId("onboarding-to-camera").click();
  await page.getByTestId("onboarding-finish").click();
  // The entry route "/" redirects to Practice in the live-first app.
  await page.waitForURL("**/practice**");
  await page.getByTestId("tab-practice").waitFor();
  return email;
}

/**
 * Drives the live-practice setup screen to a startable state and begins the
 * loop. The angle-gate "shooting arm toward camera" check can't pass from a
 * replay fixture that isn't the required side, so overrides stand in; the other
 * checks pass from the replayed pose stream.
 */
export async function startLiveLoop(page: Page): Promise<void> {
  await page.getByTestId("live-setup").waitFor();
  const start = page.getByTestId("setup-start");
  // Give the replayed pose stream a moment to satisfy the auto checks.
  await page.waitForTimeout(1500);
  if (await start.isDisabled()) {
    for (const id of ["full-body", "side-view", "lighting", "stability"]) {
      const override = page.getByTestId(`override-${id}`);
      if (await override.count()) await override.click();
    }
  }
  await start.click();
  await page.getByTestId("practice-loop").waitFor();
}
