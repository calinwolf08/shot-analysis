import { expect, test, type Page } from "@playwright/test";

/** Complete onboarding quickly (fresh context per test). */
async function onboard(page: Page) {
  await page.goto("/?e2e=replay");
  await page.waitForURL("**/onboarding**");
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-name").fill("Planner");
  await page.getByTestId("onboarding-to-camera").click();
  await page.getByTestId("onboarding-finish").click();
  await page.waitForURL(/\/\?e2e=replay$/);
}

/** Run a fixture assessment through to the results screen. */
async function assess(page: Page) {
  await page.getByTestId("start-assessment").click();
  await page.waitForURL("**/assess**");
  await page.getByTestId("assess-fixture-20190103_180930").click();
  await page.getByTestId("assess-start").click();
  await expect(page.getByTestId("assess-review")).toBeVisible({
    timeout: 90_000,
  });
  await page.getByTestId("assess-finish-review").click();
  await page.waitForURL("**/assess/results/**");
}

test("assessment → build plan → complete first drill → Home Today advances", async ({
  page,
}) => {
  await onboard(page);
  await assess(page);

  // Build the plan from results.
  await page.getByTestId("results-build-plan").click();
  await page.waitForURL("**/plan/**");
  await expect(page.getByTestId("plan-overview")).toBeVisible();

  // Header: focus chips + progress; days with a terminal re-assessment.
  expect(
    await page.getByTestId("plan-focus-chips").locator(".chip").count(),
  ).toBeGreaterThan(0);
  await expect(page.getByTestId("plan-day-13")).toContainText("Re-assessment");
  await expect(page.getByTestId("plan-day-0")).toContainText("Today");

  // Home Today card points at the first item (a drill).
  await page.goto("/?e2e=replay");
  await expect(page.getByTestId("today-card")).toBeVisible();
  const firstLabel = await page.getByTestId("today-card-title").textContent();

  // Start it → drill player opens with the plan item bound.
  await page.getByTestId("today-card-go").click();
  await page.waitForURL(/\/drill\/.*planItem=/);
  await expect(page.getByTestId("drill-player")).toBeVisible();
  await page.getByTestId("drill-complete").click();
  await expect(page.getByTestId("drill-complete")).toContainText("Completed");

  // Back home: the Today card advanced to the next pending item.
  await page.goto("/?e2e=replay");
  await expect(page.getByTestId("today-card")).toBeVisible();
  await expect(page.getByTestId("today-card-title")).not.toHaveText(
    firstLabel ?? "",
  );

  // The plan screen shows progress and the first day done.
  await page.getByTestId("today-card-plan").click();
  await page.waitForURL("**/plan/**");
  await expect(page.getByTestId("plan-day-0")).toContainText("Done");
  const progress = await page
    .getByTestId("plan-progress")
    .getAttribute("aria-valuenow");
  expect(Number(progress)).toBeGreaterThan(0);
});
