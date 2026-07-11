/**
 * Accessibility gate: axe-core scans of every main screen — no serious
 * or critical violations allowed.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
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
  await page.waitForURL((url) => url.pathname === "/");

  // Home.
  await expectClean(page, "home");

  // Assessment picker → results.
  await page.getByTestId("start-assessment").click();
  await page.waitForURL("**/assess**");
  await expectClean(page, "assess-picker");
  await page.getByTestId("assess-fixture-20190103_180930").click();
  await page.getByTestId("assess-start").click();
  await expect(page.getByTestId("assess-review")).toBeVisible({
    timeout: 90_000,
  });
  await expectClean(page, "assess-review");
  await page.getByTestId("assess-finish-review").click();
  await page.waitForURL("**/assess/results/**");
  await expectClean(page, "results");

  // Plan.
  await page.getByTestId("results-build-plan").click();
  await page.waitForURL("**/plan/**");
  await expectClean(page, "plan");

  // Drill player.
  await page.goto("/?e2e=replay");
  await page.getByTestId("today-card-go").click();
  await page.waitForURL(/\/drill\//);
  await expectClean(page, "drill");

  // Live setup.
  await page.goto("/practice/live?e2e=replay");
  await expect(page.getByTestId("live-setup")).toBeVisible();
  await expectClean(page, "live-setup");

  // Progress + profile tabs.
  await page.goto("/?e2e=replay");
  await page.getByTestId("tab-progress").click();
  await page.waitForURL("**/progress**");
  await expectClean(page, "progress");
  await page.getByTestId("tab-profile").click();
  await page.waitForURL("**/profile**");
  await expectClean(page, "profile");
});
