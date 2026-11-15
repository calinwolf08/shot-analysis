/**
 * Accessibility gate: axe-core scans of every main screen — no serious
 * or critical violations allowed.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { type Page } from "@playwright/test";
import { signUp } from "./helpers";

test.describe.configure({ timeout: 300_000 });

async function expectClean(page: Page, screen: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    blocking.map((v) => ({
      screen,
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.slice(0, 3).map((n) => n.html),
    })),
  ).toEqual([]);
}

test("main screens have no serious/critical axe violations", async ({
  page,
}) => {
  // Auth screens.
  await page.goto("/auth/sign-in?e2e=replay");
  await expectClean(page, "sign-in");

  // Sign-up → onboarding.
  await signUp(page, "?e2e=replay", "axe");
  await expectClean(page, "onboarding");

  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-name").fill("Axe");
  await page.getByTestId("onboarding-to-camera").click();
  await page.getByTestId("onboarding-finish").click();
  await page.waitForURL("**/practice**");

  // The four live-first tabs.
  await expectClean(page, "practice");

  await page.getByTestId("tab-shots").click();
  await page.waitForURL("**/shots**");
  await expectClean(page, "shots");

  await page.getByTestId("tab-insights").click();
  await page.waitForURL("**/insights**");
  await expectClean(page, "insights");

  await page.getByTestId("tab-profile").click();
  await page.waitForURL("**/profile**");
  await expectClean(page, "profile");

  // Live practice loop (setup-less: boots straight in).
  await page.goto("/practice/live?e2e=replay");
  await expect(page.getByTestId("practice-loop")).toBeVisible({
    timeout: 30_000,
  });
  await expectClean(page, "practice-loop");
});
