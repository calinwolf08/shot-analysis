/**
 * The app's contract test: one continuous replay-mode journey through
 * every core surface — onboarding → assessment → results → plan → drill
 * → live practice → summary → progress → re-assessment → adapted plan.
 */
import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

test.describe.configure({ timeout: 300_000 });

async function runFixtureAssessment(page: Page) {
  await page.getByTestId("assess-fixture-20190103_180930").click();
  await page.getByTestId("assess-start").click();
  await expect(page.getByTestId("assess-review")).toBeVisible({
    timeout: 90_000,
  });
  await page.getByTestId("assess-finish-review").click();
  await page.waitForURL("**/assess/results/**");
}

test("full journey", async ({ page }) => {
  // 1. Sign-up + onboarding.
  await onboard(page, "?e2e=replay", "Journey");

  // 2. Assessment → results (placeholder benchmark badge visible).
  await page.getByTestId("start-assessment").click();
  await page.waitForURL("**/assess**");
  await runFixtureAssessment(page);
  await expect(page.getByTestId("results-overall")).toBeVisible();
  await expect(page.getByTestId("placeholder-badge").first()).toBeVisible();
  expect(await page.locator('[data-testid^="top-issue-"]').count()).toBe(3);

  // 3. Training plan.
  await page.getByTestId("results-build-plan").click();
  await page.waitForURL("**/plan/**");
  await expect(page.getByTestId("plan-day-13")).toContainText("Re-assessment");

  // 4. Drill (day 1) with placeholder video badge; complete it.
  await page.goto("/?e2e=replay");
  await page.getByTestId("today-card-go").click();
  await page.waitForURL(/\/drill\/.*planItem=/);
  await expect(page.getByTestId("drill-video")).toBeVisible();
  await expect(page.getByTestId("placeholder-badge")).toBeVisible();
  await page.getByTestId("drill-complete").click();
  await expect(page.getByTestId("drill-complete")).toContainText("Completed");

  // 5. Live practice from the plan's focused item (2 reps) → summary.
  await page.goto("/?e2e=replay");
  await expect(page.getByTestId("today-card-title")).toContainText(
    "Focused live practice",
  );
  await page.getByTestId("today-card-go").click();
  await page.waitForURL(/\/practice\/live.*planItem=/);
  await expect(page.getByTestId("setup-start")).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId("setup-start").click();
  await expect(page.getByTestId("practice-loop")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("rep-counter")).toHaveText(/Rep 3/, {
    timeout: 120_000,
  });
  await page.getByTestId("practice-end").click();
  await page.waitForURL("**/practice/summary/**");
  await expect(page.getByTestId("summary-rep-count")).toContainText("2 reps");
  await page.getByTestId("summary-done").click();
  await page.waitForURL(/\/\?e2e=replay$/);

  // 6. Progress: both sessions on the dashboard. Wait for the dashboard to
  // finish loading (data now streams from the server) before the one-shot
  // count() — the local DB used to make this instantaneous.
  await page.getByTestId("tab-progress").click();
  await page.waitForURL("**/progress**");
  await expect(page.getByTestId("progress-dashboard")).toBeVisible();
  expect(await page.locator('[data-testid="progress-history"] a').count()).toBe(
    2,
  );
  await expect(page.getByTestId("progress-score-chart-marker-0")).toBeVisible();

  // 7. Re-assessment via the plan's terminal item → adapted plan.
  await page.getByTestId("tab-train").click();
  await page.getByTestId("today-card-plan").click();
  await page.waitForURL("**/plan/**");
  const plan1Path = new URL(page.url()).pathname;
  await page
    .getByTestId("plan-day-13")
    .getByRole("button", { name: "Re-assess" })
    .click();
  await page.waitForURL(/\/assess.*planItem=/);
  await runFixtureAssessment(page);
  await expect(page.getByTestId("delta-strip")).toBeVisible();
  await page.getByTestId("results-build-plan").click();
  await page.waitForURL("**/plan/**");
  expect(new URL(page.url()).pathname).not.toBe(plan1Path);
  await expect(page.getByTestId("plan-overview")).toBeVisible();
});
