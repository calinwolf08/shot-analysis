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
 * Waits for the continuous practice loop. The setup screen is gone: the loop
 * boots straight into practice. In replay there's no camera, so the in-loop
 * positioning gate is inactive and the replayed pose stream drives shots.
 */
export async function startLiveLoop(page: Page): Promise<void> {
  await page.getByTestId("practice-loop").waitFor({ timeout: 30_000 });
}

/**
 * Where review screenshots go: test-results/screens/<group>/<name>.png
 * (Playwright clears test-results/ at the start of each run).
 */
export function screenPath(group: string, name: string): string {
  return `test-results/screens/${group}/${name}.png`;
}

/** GET an app API route as the signed-in user (bearer token from storage). */
export async function apiGet<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(async (p) => {
    const token = localStorage.getItem("shotcoach.bearer_token");
    const res = await fetch(p, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`${p} → HTTP ${res.status}`);
    return res.json();
  }, path) as Promise<T>;
}
